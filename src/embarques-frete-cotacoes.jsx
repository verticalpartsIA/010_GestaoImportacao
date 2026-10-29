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

// Pedido de cotação em PT / EN / 中文 (chinês gerado por IA — revisar antes de uso amplo).
function efMontarMensagem(emb, cot) {
  const origem = emb.porto_origem || '—';
  const destino = emb.porto_destino || '—';
  const conts = (emb.containers || []).filter((c) => c.tipo_tamanho).map((c) => c.tipo_tamanho);
  const cont = conts.length ? conts.join(', ') : 'a confirmar';
  const etd = emb.etd_atual ? String(emb.etd_atual).split('-').reverse().join('/') : 'a confirmar';
  const ref = emb.nome_embarque || emb.referencia_embarque || '';
  const assunto = `Cotação de frete marítimo${ref ? ' — ' + ref : ''} / Ocean freight quotation / 海运报价`;
  const texto = [
    `Prezados ${cot.agente || ''},`,
    '',
    'Solicitamos cotação de frete marítimo:',
    `• Origem: ${origem}  •  Destino: ${destino}`,
    `• Container(s): ${cont}  •  ETD previsto: ${etd}`,
    '• Informar: todas as taxas (moeda e valor), transit time e free time.',
    '',
    '---',
    `Dear ${cot.agente || 'Sir/Madam'},`,
    '',
    'Please quote the ocean freight below:',
    `• Origin: ${origem}  •  Destination: ${destino}`,
    `• Container(s): ${cont}  •  Expected ETD: ${etd}`,
    '• Please include: all charges (currency and amount), transit time and free time.',
    '',
    '---',
    `尊敬的 ${cot.agente || ''}：`,
    '',
    '请提供以下海运报价：',
    `• 起运港：${origem}  •  目的港：${destino}`,
    `• 集装箱：${cont}  •  预计开船日：${etd}`,
    '• 请注明：所有费用（币种和金额）、航程时间（transit time）和免费期（free time）。',
    '',
    'Atenciosamente / Best regards / 此致',
    'VerticalParts',
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
  const [assunto, setAssunto] = React.useState(base.assunto);
  const [texto, setTexto] = React.useState(base.texto);
  const [enviando, setEnviando] = React.useState(false);
  const enviar = async () => {
    if (enviando) return;
    if (!para.trim()) { window.toast?.('Informe o e-mail do agente.', 'error'); return; }
    setEnviando(true);
    try {
      const r = await window.EmbarquesImportacaoStore.enviarPedidoCotacaoFrete(emb, cot, { to: para.trim(), subject: assunto, text: texto });
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
      <PIField label="Assunto"><PIInput value={assunto} onChange={setAssunto}/></PIField>
      <PIField label="Mensagem (PT · EN · 中文)">
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

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <strong style={{ fontSize: 14 }}>Cotações de frete marítimo</strong>
        <span className="small muted">{lista.length} de {EF.MAX_COTACOES}</span>
        <span style={{ flex: 1 }}/>
        <Button variant="primary" icon="plus" disabled={lista.length >= EF.MAX_COTACOES}
          onClick={() => onChange([...lista, EF.novaCotacao(EF.proximoId(lista))])}>Nova cotação</Button>
      </div>

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
