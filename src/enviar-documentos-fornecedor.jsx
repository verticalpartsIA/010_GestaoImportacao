/* ============================================================
   Enviar documentos ao fornecedor (08/10/2026) — botão da aba "Tratativas" de
   uma cotação a fornecedor. Depois de "Decidir comprar", reúne num único envio:
     1. o(s) arquivo(s) que o próprio fornecedor anexou na cotação dele;
     2. o Projeto de Instalação da obra — já com a página de assinaturas digitais
        quando o cliente assinou (mesmo PDF de "Baixar PDF assinado");
     3. as ID-TAGs.
   O envio usa TratativasStore.enviar (mensagem registrada + e-mail real ao
   fornecedor + vínculo com o Inbox). NÃO mexe em send-email/read-inbox.
   Arquivos que moram em bucket privado ou que são gerados na hora são copiados
   para o bucket `tratativas` (link que não expira); ID-TAG e projeto sem
   assinatura vão pelo link público que já têm.
   ============================================================ */
(function () {
  const { useState, useEffect } = React;

  const TEXTO_PADRAO = (nCot) =>
    `Hello,\n\n`
    + `The customer has approved and signed the installation project, and the down payment has been received. `
    + `Please find attached for order No. ${nCot}: (1) your quotation, (2) the signed Installation Project and (3) the ID-TAGs. `
    + `Please confirm receipt and send us the Proforma Invoice (PI) so we can start the order.\n\n`
    + `Best regards,\nVerticalParts\n\n`
    + `----\n\n`
    + `Olá,\n\n`
    + `O cliente aprovou e assinou o projeto de instalação e o sinal foi recebido. `
    + `Seguem anexos do pedido Nº ${nCot}: (1) a cotação de vocês, (2) o Projeto de Instalação assinado e (3) as ID-TAGs. `
    + `Favor confirmar o recebimento e nos enviar a Proforma Invoice (PI) para iniciarmos o pedido.\n\n`
    + `Atenciosamente,\nVerticalParts\n\n`
    + `----\n\n`
    + `您好，\n\n`
    + `客户已批准并签署安装项目，首付款已收到。`
    + `订单号 ${nCot} 的附件如下：(1) 贵司的报价单，(2) 已签署的安装项目，(3) ID-TAG。`
    + `请确认收到，并发送形式发票（PI），以便我们开始下单。\n\n`
    + `此致\nVerticalParts`;

  function CfEnviarDocumentosModal({ cot, numeroCotacao, onClose, onEnviado }) {
    const cs = window.CotacaoElevadorFornecedorStore;
    const ts = window.TratativasStore;
    const [carregando, setCarregando] = useState(true);
    const [docs, setDocs] = useState([]);
    const [texto, setTexto] = useState(TEXTO_PADRAO(numeroCotacao != null ? numeroCotacao : ''));
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState('');

    useEffect(() => {
      let vivo = true;
      (async () => {
        const lista = [];
        try {
          const resp = await cs.listarAnexosResposta(cot.id).catch(() => []);
          resp.forEach((a) => lista.push({
            k: 'resp:' + a.id, grupo: 'Cotação do fornecedor', tipo: 'resp', nome: a.nome_arquivo,
            path: a.path, mime: a.tipo_arquivo || 'application/pdf', marcado: true,
          }));
          const [desenhos, sigs] = await Promise.all([
            window.ProjetoElevadorStore.listarDesenhos().catch(() => []),
            window.DocumentoSignatariosStore.listarPorTipo('projeto_instalacao').catch(() => []),
          ]);
          const daObra = desenhos.filter((d) => numeroCotacao != null && Number(d.numero_cotacao) === Number(numeroCotacao));
          daObra.filter((d) => d.tipo_documento !== 'id_tag').forEach((d) => {
            const sig = sigs.find((s) => s.documento_id === d.id && s.status === 'assinado');
            const pdf = /\.pdf$/i.test(d.arquivo_nome || '');
            if (sig && pdf) {
              lista.push({ k: 'proj:' + d.id, grupo: 'Projeto de Instalação', tipo: 'proj_assinado', d, sig, mime: 'application/pdf', marcado: true,
                nome: 'Projeto de Instalação - ' + (d.referencia || d.arquivo_nome) + ' - assinado.pdf', aviso: 'com a página de assinaturas digitais do cliente' });
            } else {
              lista.push({ k: 'proj:' + d.id, grupo: 'Projeto de Instalação', tipo: 'url', url: d.arquivo_url, nome: d.arquivo_nome, marcado: true,
                aviso: sig ? '' : 'ATENÇÃO: o cliente ainda não assinou este projeto — vai o arquivo original' });
            }
          });
          daObra.filter((d) => d.tipo_documento === 'id_tag').forEach((d) => {
            lista.push({ k: 'tag:' + d.id, grupo: 'ID-TAG', tipo: 'url', url: d.arquivo_url, nome: d.arquivo_nome, marcado: true });
          });
        } catch (e) { if (vivo) setErro('Não foi possível listar os documentos: ' + (e.message || e)); }
        if (vivo) { setDocs(lista); setCarregando(false); }
      })();
      return () => { vivo = false; };
    }, [cot.id, numeroCotacao]);

    const marcados = docs.filter((d) => d.marcado);
    const semProjeto = !docs.some((d) => d.grupo === 'Projeto de Instalação');
    const semTag = !docs.some((d) => d.grupo === 'ID-TAG');
    const semForn = !docs.some((d) => d.grupo === 'Cotação do fornecedor');

    const enviar = async () => {
      setErro('');
      if (!marcados.length) return setErro('Marque pelo menos um documento.');
      if (!texto.trim()) return setErro('Escreva a mensagem.');
      setEnviando(true);
      try {
        const anexos = [];
        for (const d of marcados) {
          if (d.tipo === 'url') { anexos.push({ nome: d.nome, url: d.url }); continue; }
          let blob;
          if (d.tipo === 'resp') {
            const u = await cs.urlAssinadaAnexoResposta(d.path, 600);
            if (!u) throw new Error('não consegui abrir "' + d.nome + '".');
            const r = await fetch(u);
            if (!r.ok) throw new Error('não consegui ler "' + d.nome + '" (HTTP ' + r.status + ').');
            blob = await r.blob();
          } else {
            blob = await window.ProjetoAssinadoPdf.gerarBlob(d.d, window.ProjetoAssinadoPdf.assinaturasDe([d.sig]));
          }
          const up = await ts.uploadAnexo(cot.id, new File([blob], d.nome, { type: d.mime || blob.type }));
          anexos.push(up);
        }
        const r = await ts.enviar({ cotacaoFornecedorId: cot.id, numeroCotacao, mensagem: texto, anexos });
        onEnviado && onEnviado(r);
        onClose();
      } catch (e) {
        setErro('Falha ao enviar: ' + (e.message || e));
        setEnviando(false);
      }
    };

    return (
      <Modal title="Enviar documentos ao fornecedor" onClose={enviando ? () => {} : onClose} width={640}
        footer={<>
          <Button variant="ghost" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button variant="primary" icon="send" onClick={enviar} disabled={enviando || carregando}>{enviando ? 'Enviando…' : 'Enviar ao fornecedor (' + marcados.length + ')'}</Button>
        </>}>
        <p className="muted small" style={{ marginTop: 0 }}>
          Vai como uma mensagem desta Tratativa: fica registrada aqui, sai por e-mail para os contatos do fornecedor e a resposta volta para esta tela.
        </p>
        {carregando ? <div className="muted" style={{ padding: '20px 0', textAlign: 'center' }}>Procurando os documentos da cotação {numeroCotacao}…</div> : (
          <div className="stack" style={{ gap: 6 }}>
            {docs.map((d) => (
              <label key={d.k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', border: '1px solid var(--border)', padding: '6px 10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={d.marcado} disabled={enviando}
                  onChange={(e) => setDocs((prev) => prev.map((x) => x.k === d.k ? { ...x, marcado: e.target.checked } : x))}/>
                <span style={{ fontSize: 13 }}>
                  <b>{d.grupo}</b> · {d.nome}
                  {d.aviso && <span style={{ display: 'block', fontSize: 11.5, color: d.aviso.startsWith('ATENÇÃO') ? '#b45309' : 'var(--fg3)' }}>{d.aviso}</span>}
                </span>
              </label>
            ))}
            {semForn && <div className="small" style={{ color: '#b45309' }}>⚠ O fornecedor não anexou nenhum arquivo nesta cotação.</div>}
            {semProjeto && <div className="small" style={{ color: '#b45309' }}>⚠ Nenhum Projeto de Instalação salvo para a cotação {numeroCotacao} em Engenharia › Projeto de Elevadores.</div>}
            {semTag && <div className="small" style={{ color: '#b45309' }}>⚠ Nenhuma ID-TAG salva para a cotação {numeroCotacao}.</div>}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <div className="muted small" style={{ marginBottom: 4 }}>Mensagem (já em inglês, português e chinês — edite à vontade)</div>
          <textarea className="input" rows={9} value={texto} onChange={(e) => setTexto(e.target.value)} disabled={enviando}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 12.5 }}/>
        </div>
        {erro && <div style={{ marginTop: 8, padding: '8px 10px', fontSize: 12, border: '1px solid #fbb039', background: '#fff8e6', color: '#8a5a00' }}>⚠ {erro}</div>}
      </Modal>
    );
  }

  Object.assign(window, { CfEnviarDocumentosModal });
}());
