/* ============================================================
   embarques-frete-cotacoes.jsx — Cotações de frete marítimo (aba Frete
   do embarque, /gestao-importacao/embarques-importacao/frete).
   Até 4 cotações: agente escolhido no Cadastro de Fornecedores, tabela de
   taxas (USD/BRL) com totais, transit/free time, anexos (PDF/imagem),
   envio do pedido por e-mail (send-email → Inbox) e vencedora única.
   Regras puras em embarques-frete-calc.js; gravação em
   embarques-importacao-store.js. window.EIFreteCotacoes
   ============================================================ */
const EF_BRL = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const EF_USD = (n) => '$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Pedido de cotação ao agente brasileiro (só PT-BR), no modelo dos e-mails reais da equipe de Importação.
// Dados vêm do embarque e das P.I. vinculadas; o que faltar sai "a confirmar" e o texto é editável antes de enviar.
function efDataCurta(iso, ano) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return ano ? `${d}/${m}/${a.slice(2)}` : `${d}/${m}`;
}
function efMontarMensagem(emb, cot) {
  const r = emb.resumoPI || {};
  const conf = 'a confirmar';
  const origem = emb.porto_origem || conf;
  const destino = emb.porto_destino || conf;
  const incoterm = (r.incoterms || []).join(' / ') || conf;
  const conts = {};
  (emb.containers || []).filter((c) => c.tipo_tamanho).forEach((c) => { const t = String(c.tipo_tamanho).replace(/'/g, ''); conts[t] = (conts[t] || 0) + 1; });
  const cont = Object.keys(conts).length ? Object.keys(conts).map((t) => `${conts[t]}*${t}`).join(' + ') : conf;
  const etd = efDataCurta(emb.etd_atual);
  const pronta = emb.data_carregamento ? 'Prontidão em ' + efDataCurta(emb.data_carregamento, true) : conf;
  const ncm = (r.ncms || []).join(';') || conf;
  const carga = (r.categorias || []).join(', ') || conf;
  const valor = r.valorTotal ? `${r.moeda || 'USD'} ${Number(r.valorTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : conf;
  const ref = emb.nome_embarque || emb.referencia_embarque || '';
  const assunto = [ref, 'COTAÇÃO DE FRETE MARÍTIMO', `${(emb.porto_origem || '').toUpperCase()} x ${(emb.porto_destino || '').toUpperCase()}`, (r.incoterms || []).join('/'), etd ? 'ETD: ' + etd : '']
    .filter((x) => x && x.trim() && x.trim() !== 'x').join(' - ');
  const primeiro = String(cot.contato || '').trim().split(/\s+/)[0];
  const texto = [
    `Bom dia${primeiro ? ', ' + primeiro : ''},`,
    'Por favor, poderia nos enviar uma cotação de frete marítimo. Seguem abaixo os detalhes:',
    '',
    `Favor confirmar se haverá disponibilidade de bookings – ETD: ${etd || conf}`,
    '',
    `Container(s): ${cont}`,
    `Origem: ${origem}`,
    `Destino: ${destino}`,
    `Incoterms: ${incoterm}`,
    `Situação da carga: ${pronta}`,
    `NCM: ${ncm}`,
    `Carga: ${carga}`,
    `Valor: ${valor}`,
    '',
    'Somente via DIRETA',
    'Free time: 21 dias',
    'Precisaremos de seguro.',
    'Favor informar na cotação qual o armador, e observar que só trabalhamos com cobrança PTAX/BC + spread 1,5%.',
    '',
    'No aguardo.',
    'Atenciosamente,',
  ].join('\n');
  return { assunto, texto };
}

function EFAgenteSelect({ cot, onPick }) {
  const [lista, setLista] = React.useState([]);
  const [todos, setTodos] = React.useState(false);
  React.useEffect(() => {
    const S = window.CadastrosFornecedoresStore;
    if (!S) return;
    S.listarAtivos(todos ? undefined : 'Agente de Carga').then(setLista).catch(() => setLista([]));
  }, [todos]);
  const nome = (f) => f.nome_fantasia || f.razao_social;
  return (
    <div className="stack" style={{ gap: 4 }}>
      <select className="input" value={cot.fornecedor_id || ''} onChange={(e) => {
        const f = lista.find((x) => String(x.id) === e.target.value);
        onPick(f ? { fornecedor_id: f.id, agente: nome(f), email: f.email || '', contato: f.contato || '' } : { fornecedor_id: null, agente: '', email: '', contato: '' });
      }}>
        <option value="">— escolher no cadastro de fornecedores —</option>
        {cot.fornecedor_id && !lista.some((x) => x.id === cot.fornecedor_id) && <option value={cot.fornecedor_id}>{cot.agente}</option>}
        {lista.map((f) => <option key={f.id} value={f.id}>{nome(f)}</option>)}
      </select>
      <label className="small muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)}/> mostrar todos os fornecedores (não só "Agente de Carga")
      </label>
    </div>
  );
}

function EFEnvioPanel({ emb, cot, onClose, onEnviado }) {
  const base = React.useMemo(() => efMontarMensagem(emb, cot), []);
  const [para, setPara] = React.useState(cot.email || '');
  const [cc, setCc] = React.useState(() => (window.EmailEnvioHelper ? window.EmailEnvioHelper.ccSalvo() : ''));
  const [assunto, setAssunto] = React.useState(base.assunto);
  const [texto, setTexto] = React.useState(base.texto);
  const [enviando, setEnviando] = React.useState(false);
  const enviar = async () => {
    if (enviando) return;
    if (!para.trim()) { window.toast?.('Informe o e-mail do agente.', 'error'); return; }
    setEnviando(true);
    try {
      const r = await window.EmbarquesImportacaoStore.enviarPedidoCotacaoFrete(emb, cot, { to: para.trim(), cc, subject: assunto, text: texto });
      if (r.ok) { window.toast?.('Pedido enviado por e-mail (fica em Enviados no Inbox).', 'success'); onEnviado(r.envio); onClose(); }
      else {
        window.toast?.('Não foi possível enviar pelo sistema. Abrindo seu programa de e-mail — este envio NÃO foi registrado.', 'error');
        window.location.href = `mailto:${encodeURIComponent(para.trim())}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
      }
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setEnviando(false); }
  };
  const nAnexos = (cot.anexos || []).length;
  return (
    <div className="stack" style={{ gap: 8, padding: 12, border: '1px solid var(--vp-yellow, #f5c400)', borderRadius: 8, background: 'var(--vp-gray-50)' }}>
      <strong style={{ fontSize: 13 }}>Enviar pedido de cotação</strong>
      <PIField label="Para"><PIInput value={para} onChange={setPara} placeholder="e-mail do agente"/></PIField>
      {window.EmailCcInput && <window.EmailCcInput value={cc} onChange={setCc} />}
      <PIField label="Assunto"><PIInput value={assunto} onChange={setAssunto}/></PIField>
      <PIField label="Mensagem">
        <textarea className="input" rows={12} value={texto} onChange={(e) => setTexto(e.target.value)}/>
      </PIField>
      <p className="small muted">
        {nAnexos ? `${nAnexos} anexo(s) vão junto (até 2,5 MB somados; o que passar vai como link no texto).` : 'Sem anexos.'} Sai por suporte@vpsistema.com e a resposta aparece no Inbox.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="primary" onClick={enviar} disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar e-mail'}</Button>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  );
}

function EFCotacaoCard({ idx, cot, emb, isEdit, onChange, onRemove, onVencedor, persistir }) {
  const EF = window.EmbFreteCalc;
  const S = window.EmbarquesImportacaoStore;
  const [enviando, setEnviando] = React.useState(false);
  const [upando, setUpando] = React.useState(false);
  const [respostas, setRespostas] = React.useState([]);
  const t = EF.totais(cot.taxas);
  const upd = (patch) => onChange({ ...cot, ...patch });
  const setTaxa = (i, patch) => upd({ taxas: cot.taxas.map((x, k) => (k === i ? { ...x, ...patch } : x)) });

  React.useEffect(() => {
    if (!isEdit) return;
    let vivo = true;
    const carregar = () => S.respostasFrete(cot.id).then((r) => { if (vivo) setRespostas(r); });
    carregar();
    const iv = setInterval(carregar, 60000);
    return () => { vivo = false; clearInterval(iv); };
  }, [cot.id, isEdit]);

  const anexar = async (files) => {
    if (!isEdit) { window.toast?.('Salve o embarque antes de anexar arquivos.', 'error'); return; }
    setUpando(true);
    try {
      let atual = cot;
      for (const f of Array.from(files)) {
        const a = await S.uploadAnexoFrete(emb.id, cot.id, f);
        atual = { ...atual, anexos: [...(atual.anexos || []), a] };
      }
      onChange(atual);
      await persistir(atual);
      window.toast?.('Anexo(s) salvo(s).', 'success');
    } catch (e) { window.toast?.('Erro ao anexar: ' + e.message, 'error'); }
    finally { setUpando(false); }
  };
  const removerAnexo = async (i) => {
    if (!window.confirm('Remover este anexo da cotação? (o arquivo continua guardado no sistema)')) return;
    const atual = { ...cot, anexos: cot.anexos.filter((_, k) => k !== i) };
    onChange(atual);
    if (isEdit) await persistir(atual).catch((e) => window.toast?.('Erro: ' + e.message, 'error'));
  };

  return (
    <div className="stack" style={{
      gap: 10, padding: 14, borderRadius: 10, background: '#fff',
      border: cot.vencedor ? '2px solid #00aa00' : '1px solid var(--border)',
      boxShadow: cot.vencedor ? '0 0 0 3px #eafaf0' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ flex: 1 }}>Cotação {idx + 1}</strong>
        <button type="button" onClick={onVencedor}
          style={{ background: cot.vencedor ? '#00aa00' : '#fff', color: cot.vencedor ? '#fff' : '#111', border: '1px solid ' + (cot.vencedor ? '#00aa00' : 'var(--border)'), borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
          🏆 {cot.vencedor ? 'Vencedor' : 'Definir como vencedor'}
        </button>
        <button type="button" title="Remover cotação" onClick={onRemove} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 16 }}>✕</button>
      </div>

      <PIField label="Agente / armador / transportadora">
        <EFAgenteSelect cot={cot} onPick={upd}/>
      </PIField>
      <div className="grid-2" style={{ gap: 8 }}>
        <PIField label="E-mail"><PIInput value={cot.email} onChange={(v) => upd({ email: v })} placeholder="e-mail para o pedido"/></PIField>
        <PIField label="Contato"><PIInput value={cot.contato} onChange={(v) => upd({ contato: v })}/></PIField>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>TAXAS</th><th style={{ width: 110 }}>MOEDA</th><th style={{ width: 120 }}>VALOR</th><th style={{ width: 28 }}></th></tr></thead>
          <tbody>
            {cot.taxas.map((x, i) => (
              <tr key={i}>
                <td><input className="input" value={x.descricao} placeholder="Ex.: Frete marítimo, THC…" onChange={(e) => setTaxa(i, { descricao: e.target.value })}/></td>
                <td>
                  <select className="input" value={x.moeda} onChange={(e) => setTaxa(i, { moeda: e.target.value })}>
                    {EF.MOEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
                <td><input className="input" type="number" step="0.01" value={x.valor} onChange={(e) => setTaxa(i, { valor: e.target.value })}/></td>
                <td><button type="button" title="Remover taxa" onClick={() => upd({ taxas: cot.taxas.filter((_, k) => k !== i) })} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div><Button variant="ghost" icon="plus" onClick={() => upd({ taxas: [...cot.taxas, EF.novaTaxa()] })}>Adicionar taxa</Button></div>
      <div style={{ display: 'flex', gap: 16, fontWeight: 600 }}>
        <span>Total USD: {EF_USD(t.usd)}</span>
        <span>Total BRL: {EF_BRL(t.brl)}</span>
      </div>

      <div className="grid-2" style={{ gap: 8 }}>
        <PIField label="Transit time (dias)"><PIInput type="number" value={cot.transit_time} onChange={(v) => upd({ transit_time: v })}/></PIField>
        <PIField label="Free time (dias)"><PIInput type="number" value={cot.free_time} onChange={(v) => upd({ free_time: v })}/></PIField>
      </div>
      <PIField label="Observação"><PIInput value={cot.observacao} onChange={(v) => upd({ observacao: v })}/></PIField>

      <div className="stack" style={{ gap: 6 }}>
        <strong style={{ fontSize: 12.5 }}>Anexos (documentos e imagens)</strong>
        {(cot.anexos || []).map((a, i) => (
          <div key={a.path || i} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5 }}>
            <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>📎 {a.nome}</a>
            <button type="button" title="Remover anexo" onClick={() => removerAnexo(i)} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}>✕</button>
          </div>
        ))}
        <input type="file" multiple disabled={!isEdit || upando} accept="image/*,.pdf,.xls,.xlsx,.doc,.docx,.csv"
          onChange={(e) => { if (e.target.files && e.target.files.length) anexar(e.target.files); e.target.value = ''; }}/>
        {!isEdit && <span className="small muted">Salve o embarque para poder anexar arquivos e enviar o e-mail.</span>}
        {upando && <span className="small muted">Enviando arquivo…</span>}
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="primary" disabled={!isEdit || !cot.fornecedor_id && !cot.email} onClick={() => setEnviando(true)}>✉ Enviar pedido de cotação</Button>
          {respostas.length > 0 && <span style={{ fontSize: 12, color: '#00701f', fontWeight: 600 }}>● Respondeu por e-mail ({respostas.length})</span>}
        </div>
        {respostas.map((r) => (
          <a key={r.id} href={'/geral/inbox/' + r.id} className="small" target="_blank" rel="noopener noreferrer">
            ↳ {r.de_nome || r.de_email} — {r.assunto || '(sem assunto)'} · abrir no Inbox
          </a>
        ))}
        {(cot.envios || []).length > 0 && (
          <div className="small muted">
            {cot.envios.map((e, i) => <div key={i}>Enviado em {new Date(e.em).toLocaleString('pt-BR')} para {e.para}{e.por ? ' por ' + e.por : ''}</div>)}
          </div>
        )}
        {enviando && (
          <EFEnvioPanel emb={emb} cot={cot} onClose={() => setEnviando(false)}
            onEnviado={async (envio) => {
              const atual = { ...cot, envios: [...(cot.envios || []), envio] };
              onChange(atual);
              await persistir(atual).catch((e) => window.toast?.('Enviado, mas não consegui gravar o histórico: ' + e.message, 'error'));
            }}/>
        )}
      </div>
    </div>
  );
}

// Envio único: marca de 1 a 4 agentes do cadastro e um clique manda um e-mail para cada um
// (mesma mensagem, saudação com o 1º nome do contato de cada agente). Cria o cartão de quem ainda não tem.
function EFEnvioMultiplo({ lista, emb, isEdit, onChange, onClose }) {
  const EF = window.EmbFreteCalc;
  const [agentes, setAgentes] = React.useState([]);
  const [todos, setTodos] = React.useState(false);
  const [sel, setSel] = React.useState(() => lista.filter((c) => c.fornecedor_id).map((c) => String(c.fornecedor_id)));
  const base = React.useMemo(() => efMontarMensagem(emb, { contato: '' }), []);
  const [assunto, setAssunto] = React.useState(base.assunto);
  const [texto, setTexto] = React.useState(base.texto);
  const [cc, setCc] = React.useState(() => (window.EmailEnvioHelper ? window.EmailEnvioHelper.ccSalvo() : ''));
  const [enviando, setEnviando] = React.useState(false);
  const [resultado, setResultado] = React.useState([]);
  React.useEffect(() => {
    const S = window.CadastrosFornecedoresStore;
    if (!S) return;
    S.listarAtivos(todos ? undefined : 'Agente de Carga').then(setAgentes).catch(() => setAgentes([]));
  }, [todos]);
  const nome = (f) => f.nome_fantasia || f.razao_social;
  const jaTem = (id) => lista.find((c) => String(c.fornecedor_id) === String(id));
  const novos = sel.filter((id) => !jaTem(id)).length;
  const cheio = lista.length + novos > EF.MAX_COTACOES;
  const alternar = (id) => setSel((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  const enviar = async () => {
    if (enviando || !sel.length) return;
    if (!isEdit) { window.toast?.('Salve o embarque antes de enviar.', 'error'); return; }
    if (cheio) { window.toast?.(`No máximo ${EF.MAX_COTACOES} cotações por embarque.`, 'error'); return; }
    const jaEnviados = sel.map(jaTem).filter((c) => c && (c.envios || []).length);
    if (jaEnviados.length && !window.confirm('Já foi enviado pedido para ' + jaEnviados.map((c) => c.agente).join(', ') + '. Enviar de novo para todos os marcados?')) return;
    setEnviando(true);
    try {
      // 1) garante o cartão de cada agente marcado e grava (precisa existir antes do envio: o vínculo da resposta usa o id da cotação)
      let atual = lista.slice();
      const alvo = [];
      sel.forEach((id) => {
        let c = atual.find((x) => String(x.fornecedor_id) === String(id));
        if (!c) {
          const f = agentes.find((x) => String(x.id) === String(id));
          if (!f) return;
          c = { ...EF.novaCotacao(EF.proximoId(atual)), fornecedor_id: f.id, agente: nome(f), email: f.email || '', contato: f.contato || '' };
          atual = [...atual, c];
        }
        alvo.push(c.id);
      });
      onChange(atual);
      await window.EmbarquesImportacaoStore.salvarCotacoesFrete(emb.id, atual);
      // 2) um e-mail por agente (em sequência, para não estourar o limite de envios)
      const res = [];
      for (const cid of alvo) {
        const c = atual.find((x) => x.id === cid);
        if (!c.email || !c.email.trim()) { res.push({ nome: c.agente, ok: false, motivo: 'sem e-mail no cadastro' }); continue; }
        const primeiro = String(c.contato || '').trim().split(/\s+/)[0];
        const corpo = texto.replace(/^Bom dia,?/, 'Bom dia' + (primeiro ? ', ' + primeiro : '') + ',');
        try {
          const r = await window.EmbarquesImportacaoStore.enviarPedidoCotacaoFrete(emb, c, { to: c.email.trim(), cc, subject: assunto, text: corpo });
          if (r.ok) { atual = atual.map((x) => (x.id === cid ? { ...x, envios: [...(x.envios || []), r.envio] } : x)); res.push({ nome: c.agente, ok: true, para: c.email.trim() }); }
          else res.push({ nome: c.agente, ok: false, motivo: 'o sistema não conseguiu enviar' });
        } catch (e) { res.push({ nome: c.agente, ok: false, motivo: e.message }); }
      }
      onChange(atual);
      await window.EmbarquesImportacaoStore.salvarCotacoesFrete(emb.id, atual).catch((e) => window.toast?.('Enviado, mas não consegui gravar o histórico: ' + e.message, 'error'));
      setResultado(res);
      const ok = res.filter((x) => x.ok).length;
      window.toast?.(`${ok} de ${res.length} pedido(s) enviado(s) (ficam em Enviados no Inbox).`, ok === res.length ? 'success' : 'error');
    } catch (e) { window.toast?.('Erro: ' + e.message, 'error'); }
    finally { setEnviando(false); }
  };

  return (
    <div className="stack" style={{ gap: 8, padding: 12, border: '1px solid var(--vp-yellow, #f5c400)', borderRadius: 8, background: 'var(--vp-gray-50)' }}>
      <strong style={{ fontSize: 13 }}>Pedir cotação a vários agentes (um e-mail para cada)</strong>
      <div className="small muted">Marque de 1 a {EF.MAX_COTACOES} agentes. O e-mail e o contato vêm do cadastro; quem ainda não tem cartão ganha um.</div>
      <div style={{ display: 'grid', gap: 4, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {agentes.map((f) => {
          const id = String(f.id);
          return (
            <label key={id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={sel.includes(id)} onChange={() => alternar(id)}/>
              <span>{nome(f)}</span>
              <span className="small muted">{f.email || 'sem e-mail'}</span>
            </label>
          );
        })}
      </div>
      <label className="small muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)}/> mostrar todos os fornecedores (não só "Agente de Carga")
      </label>
      {cheio && <div className="small" style={{ color: '#b00020' }}>Marcados demais: com os cartões que já existem passa de {EF.MAX_COTACOES}.</div>}
      {window.EmailCcInput && <window.EmailCcInput value={cc} onChange={setCc} />}
      <PIField label="Assunto (igual para todos)"><PIInput value={assunto} onChange={setAssunto}/></PIField>
      <PIField label="Mensagem (a saudação ganha o nome do contato de cada agente)">
        <textarea className="input" rows={12} value={texto} onChange={(e) => setTexto(e.target.value)}/>
      </PIField>
      {resultado.length > 0 && (
        <div className="stack" style={{ gap: 2 }}>
          {resultado.map((r, i) => <div key={i} className="small" style={{ color: r.ok ? '#00701f' : '#b00020' }}>{r.ok ? '✓' : '✕'} {r.nome}{r.ok ? ' — enviado para ' + r.para : ' — ' + r.motivo}</div>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="primary" onClick={enviar} disabled={enviando || !sel.length || cheio || !isEdit}>{enviando ? 'Enviando…' : `✉ Enviar a ${sel.length || ''} agente(s)`}</Button>
        <Button variant="ghost" onClick={onClose}>Fechar</Button>
      </div>
      {!isEdit && <span className="small muted">Salve o embarque para poder enviar.</span>}
    </div>
  );
}

function EIFreteCotacoes({ cotacoes, onChange, emb, isEdit }) {
  const EF = window.EmbFreteCalc;
  const lista = EF.normalizar(cotacoes);
  // Persiste só a coluna das cotações (anexo/envio); o resto do embarque só grava no "Salvar alterações".
  const persistir = async (cotAtual) => {
    if (!isEdit || !emb || !emb.id) return;
    const outras = lista.map((c) => (c.id === cotAtual.id ? cotAtual : c));
    await window.EmbarquesImportacaoStore.salvarCotacoesFrete(emb.id, outras);
  };
  const troca = (id, nova) => onChange(lista.map((c) => (c.id === id ? nova : c)));
  const [multi, setMulti] = React.useState(false);

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <strong style={{ fontSize: 14 }}>Cotações de frete marítimo</strong>
        <span className="small muted">{lista.length} de {EF.MAX_COTACOES}</span>
        <span style={{ flex: 1 }}/>
        <Button variant="ghost" onClick={() => setMulti((v) => !v)}>✉ Pedir a vários agentes</Button>
        <Button variant="primary" icon="plus" disabled={lista.length >= EF.MAX_COTACOES}
          onClick={() => onChange([...lista, EF.novaCotacao(EF.proximoId(lista))])}>Nova cotação</Button>
      </div>

      {multi && <EFEnvioMultiplo lista={lista} emb={emb} isEdit={isEdit} onChange={onChange} onClose={() => setMulti(false)}/>}

      {lista.length === 0 && <p className="small muted">Nenhuma cotação ainda. Clique em "Nova cotação" para comparar até {EF.MAX_COTACOES} agentes. A vencedora preenche o agente, o frete e os prazos do embarque.</p>}

      {lista.length > 1 && (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Agente</th><th>Total USD</th><th>Total BRL</th><th>Transit</th><th>Free time</th><th></th></tr></thead>
            <tbody>
              {lista.map((c, i) => {
                const t = EF.totais(c.taxas);
                return (
                  <tr key={c.id} style={c.vencedor ? { background: '#eafaf0', fontWeight: 600 } : undefined}>
                    <td>{c.agente || `Cotação ${i + 1}`}</td><td>{EF_USD(t.usd)}</td><td>{EF_BRL(t.brl)}</td>
                    <td>{c.transit_time ? c.transit_time + ' d' : '—'}</td><td>{c.free_time ? c.free_time + ' d' : '—'}</td>
                    <td>{c.vencedor ? '🏆 Vencedor' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        {lista.map((c, i) => (
          <EFCotacaoCard key={c.id} idx={i} cot={c} emb={emb} isEdit={isEdit}
            onChange={(nova) => troca(c.id, nova)}
            onVencedor={() => onChange(EF.definirVencedor(lista, c.id))}
            onRemove={() => { if (window.confirm('Remover esta cotação? Os anexos continuam guardados no sistema.')) onChange(lista.filter((x) => x.id !== c.id)); }}
            persistir={persistir}/>
        ))}
      </div>
    </div>
  );
}

window.EIFreteCotacoes = EIFreteCotacoes;
