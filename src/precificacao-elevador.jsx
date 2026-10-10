/* ============================================================
   precificacao-elevador.jsx
   Precificação de Elevador (ADM/Financeiro) — herda o Cotação Nº do
   Formulário de Elevadores e os custos já respondidos pelo fornecedor,
   calcula o preço de venda (PrecificacaoElevadorEngine) e o DIFAL
   (DifalEngine). Lista as cotações respondidas + tela de cálculo.
   ============================================================ */

/* Mesma lista de formulario-elevador.jsx (FE_TRACOES), com nome próprio:
   ambos rodam como <script> clássico no mesmo escopo global — reusar o
   identificador "FE_TRACOES" daria SyntaxError de redeclaração. */
const PZ_TRACOES = ['2:1', '4:1'];

/* 31/08 — pedido do usuário: "Instalação e Montagem" deixa de ser lista
   livre (adicionar/remover qualquer item) e passa a ser uma lista FIXA de
   7 itens — o conjunto que já estava em uso real na VPPC-0950 no momento
   do pedido. "MÃO DE OBRA" deixa de ser digitado à mão: herda a soma de
   TODAS as unidades da tabela "Mão de obra — busca automática" (Confirmado
   + Estimativa — confirmado com o usuário: numa cotação com 2 equipamentos,
   o valor esperado é a soma dos dois, não só das confirmadas). Os outros 6
   continuam manuais — preenchimento avulso de Engenharia/Logística. */
const PZ_ITENS_INSTALACAO_FIXOS = ['MÃO DE OBRA', 'CUSTOS ENGENHARIA', 'ART', 'ANDAIME', 'TALHA', 'EMPILHADEIRA', 'AJUDANTES'];

function pzMoTotalRs(pz) {
  return (pz.mo_lookup || []).reduce((s, mo) => s + (Number(mo.valorRs) || 0), 0);
}

/* Reconcilia itens_instalacao_montagem (que pode vir do banco com nomes
   livres/antigos) pra sempre bater com PZ_ITENS_INSTALACAO_FIXOS, na
   mesma ordem — casando por descrição (trim + maiúsculas) pra não perder
   valor já digitado em precificações antigas. Item sem correspondência
   nasce com valor 0 — nunca inventa número. */
function pzNormalizarItensInstalacao(pz) {
  const existentes = pz.itens_instalacao_montagem || [];
  const moTotal = pzMoTotalRs(pz);
  const itens = PZ_ITENS_INSTALACAO_FIXOS.map((label) => {
    if (label === 'MÃO DE OBRA') return { descricao: label, valor: moTotal };
    const achado = existentes.find((it) => (it.descricao || '').trim().toUpperCase() === label);
    return { descricao: label, valor: achado ? achado.valor : 0 };
  });
  return { ...pz, itens_instalacao_montagem: itens };
}

function fmtBRL2(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtPct2(v) { return ((Number(v) || 0) * 100).toFixed(2) + '%'; }

/* `faltando`: célula obrigatória vazia/inválida — "acende" (borda e fundo vermelhos, ver styles/planilha.css)
   quando o Financeiro tenta Calcular sem preencher. `obrigatorio` só põe o asterisco no rótulo. */
function PZField({ label, children, span, faltando, obrigatorio, aviso }) {
  return (
    <div className={'stack' + (faltando ? ' pl-faltando' : '')} style={{ gap: 4, gridColumn: span ? `span ${span}` : undefined }}>
      <label className="up-eyebrow muted">{label}{obrigatorio ? ' *' : ''}</label>
      {children}
      {faltando && <div className="pl-faltando__msg">{aviso || 'Campo obrigatório — preencha para calcular.'}</div>}
    </div>
  );
}
/* Preço de venda equipamento a equipamento (VPEL-EL0985-1 = R$ x, …). O
   preço total é rateado pelo custo do fornecedor de cada unidade, então
   equipamentos diferentes têm preços diferentes — a soma sozinha esconde isso.
   Calcula na hora a partir do preço do card, então vale também para
   precificações salvas antes do motor devolver o rateio. */
function PZPrecoPorEquipamento({ modelos, moLookup, precoTotal, ceo, onCeo, res, onAplicar }) {
  const E = window.PrecificacaoElevadorEngine;
  const rateio = E && E.ratearPorModelo ? E.ratearPorModelo(modelos, precoTotal) : [];
  const linhas = [];
  rateio.forEach((m, i) => {
    const fisicos = (moLookup || [])
      .filter((x) => x.unidadeId && x.unidadeId === m.unidadeId && x.identificador)
      .sort((a, b) => (Number(a.equipamentoIndice) || 0) - (Number(b.equipamentoIndice) || 0));
    // Usa sempre o código da linha física (mo_lookup): com a numeração corrida 1..N o
    // código da Unidade do Formulário pode ser outro equipamento (inclusive com 1 só).
    if (fisicos.length && fisicos.length === m.quantidade) {
      fisicos.forEach((f) => linhas.push({ chave: `${m.unidadeId || i}-${f.identificador}`, id: f.identificador, valor: m.valorUnitarioRs, mo: Number(f.valorRs) || 0, keyCeo: `${m.unidadeId}:${f.equipamentoIndice || 1}` }));
    } else {
      linhas.push({
        chave: m.unidadeId || String(i), id: m.identificador || `Equipamento ${i + 1}`, valor: m.valorUnitarioRs,
        extra: m.quantidade > 1 ? `cada · × ${m.quantidade}` : '', mo: 0, keyCeo: `${m.unidadeId || i}:1`,
      });
    }
  });
  const [todos, setTodos] = React.useState('');
  if (!linhas.length) return null;
  // Códigos corridos 1..N (menor → maior paradas): lista na mesma ordem dos códigos.
  const numDe = (id) => { const m = /-(\d+)$/.exec(id || ''); return m ? Number(m[1]) : Infinity; };
  linhas.sort((a, b) => numDe(a.id) - numDe(b.id));

  /* "VLR Sugerido CEO" = o LÍQUIDO (lucro) por equipamento que o CEO quer receber (regra do Financeiro, 10/10/2026).
     Ex.: o cálculo dá R$ 48.000 de líquido por equipamento e o CEO quer R$ 35.000 → a diferença sai do PREÇO da proposta
     (desconto). Como impostos e comissões incidem sobre o preço, para o líquido cair exatamente R$ 13.000 o preço cai um
     pouco mais (13.000 ÷ (1 − % impostos − % comissões)) — a tela mostra os dois números. O campo nasce vazio em toda
     precificação; linha em branco = continua o calculado. O líquido de cada equipamento é a parte dele no lucro total
     (na proporção do preço), já descontada a mão de obra específica dele. */
  const comCeo = !!onCeo;
  const pvRes = res && res.precificacao ? res.precificacao : null;
  const P0 = pvRes ? Number(pvRes.precoVendaProposta) || 0 : 0;
  const lucroTotal = pvRes ? Number(pvRes.lucroFinal) || 0 : 0;
  const comPct = pvRes && P0 > 0 ? ((Number(pvRes.comissaoConsultoriaRs) || 0) + (Number(pvRes.comissaoVendedorRs) || 0) + (Number(pvRes.comissaoIndicacaoRs) || 0)) / P0 : 0;
  const m = pvRes ? 1 - (Number(pvRes.impostosPagarProdutoPct) || 0) - comPct : 0; // quanto de cada R$ de preço vira lucro
  const totalCalc = linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const valCeo = (l) => { const v = ceo ? ceo[l.keyCeo] : null; return v === undefined || v === null || v === '' ? null : Number(v); };
  /* Líquido de cada equipamento: rateio por participação no preço, exceto a mão de obra, que cada um paga a sua
     (E.ratearLucroPorEquipamento — a soma fecha SEMPRE no lucro total). */
  const lucros = E && E.ratearLucroPorEquipamento
    ? E.ratearLucroPorEquipamento({ lucroTotal, precoTotal: totalCalc, linhas: linhas.map((l) => ({ preco: Number(l.valor) || 0, mo: l.mo || 0 })) })
    : linhas.map((l) => (totalCalc > 0 ? lucroTotal * (Number(l.valor) || 0) / totalCalc : 0));
  const calcLinha = (l, k) => {
    const lucro = lucros[k];
    const c = valCeo(l);
    const difLucro = c != null ? lucro - c : 0;                 // quanto o líquido precisa cair (negativo = subir)
    const desconto = c != null && m > 0 ? difLucro / m : 0;     // quanto o PREÇO cai
    return { lucro, c, difLucro, desconto, novoPreco: (Number(l.valor) || 0) - desconto };
  };
  const calcs = linhas.map(calcLinha);
  const algumCeo = comCeo && calcs.some((x) => x.c != null);
  const descontoTotal = calcs.reduce((s, x) => s + x.desconto, 0);
  const novoTotal = totalCalc - descontoTotal;
  const lucroNovo = lucroTotal - calcs.reduce((s, x) => s + x.difLucro, 0);
  const alav = algumCeo && res && E && E.alavancaParaPreco ? E.alavancaParaPreco(res, novoTotal) : null;
  const aplicarTodos = () => {
    const v = Number(String(todos).replace(/\./g, '').replace(',', '.')) || 0;
    if (!(v > 0)) return;
    const patch = {}; linhas.forEach((l) => { patch[l.keyCeo] = v; });
    onCeo(patch);
  };
  const dinheiroSinal = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtBRL2(Math.abs(v))}`;

  return (
    <div>
      <span className="up-eyebrow muted">Preço de venda por equipamento</span>
      {comCeo && (
        <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap', margin: '6px 0' }}>
          <span className="small muted">Lucro líquido por equipamento que o CEO quer receber (depois de custos, impostos e comissões):</span>
          <input className="input" style={{ width: 150 }} inputMode="decimal" placeholder="ex.: 35.000" value={todos} onChange={(e) => setTodos(e.target.value)}/>
          <Button variant="outline" size="sm" onClick={aplicarTodos}>Preencher todos</Button>
          {algumCeo && <Button variant="ghost" size="sm" onClick={() => { const patch = {}; linhas.forEach((l) => { patch[l.keyCeo] = null; }); onCeo(patch); setTodos(''); }}>Limpar</Button>}
        </div>
      )}
      <div className="table-wrap" style={{ marginTop: 6 }}>
        <table className="pl-grid">
          <thead><tr>
            <th>Equipamento</th><th>VLR Proposta</th>
            {comCeo && <th title="Lucro LÍQUIDO do equipamento (o que sobra depois de pagar mercadoria, frete, despesas, impostos, comissões e DIFAL) = (lucro total + soma da mão de obra) × (VLR Proposta do equipamento ÷ preço total) − mão de obra do equipamento. A soma de todos fecha no lucro total.">Lucro líquido por Equip.</th>}
            {comCeo && <th>Lucro líquido desejado (CEO)</th>}
            {comCeo && <th>Desconto no preço</th>}
            {comCeo && <th>Preço p/ Venda</th>}
          </tr></thead>
          <tbody>
            {linhas.map((l, k) => {
              const c = calcs[k];
              return (
                <tr key={l.chave}>
                  <td className="mono" style={{ fontSize: 13 }}>{l.id}{l.extra ? <span className="muted"> ({l.extra})</span> : null}</td>
                  <td className="pl-calc-cell cell-money" style={{ fontSize: 14 }}>{fmtBRL2(l.valor)}</td>
                  {comCeo && <td className="pl-calc-cell mono">{fmtBRL2(c.lucro)}</td>}
                  {comCeo && (
                    <td className="pl-edit-cell" style={{ minWidth: 150 }}>
                      <PZCurrencyInput moeda="BRL" value={c.c} onChange={(v) => onCeo({ [l.keyCeo]: (v === '' || v === 0) ? null : v })}/>
                    </td>
                  )}
                  {comCeo && <td className="pl-calc-cell mono" style={{ color: c.c == null ? undefined : c.desconto > 0 ? '#b91c1c' : '#15803d' }}>{c.c == null ? '—' : c.desconto > 0 ? `−${fmtBRL2(c.desconto)}` : c.desconto < 0 ? `+${fmtBRL2(-c.desconto)}` : fmtBRL2(0)}</td>}
                  {comCeo && <td className="pl-calc-cell cell-money" style={{ fontWeight: c.c == null ? 400 : 700 }}>{c.c == null ? '—' : fmtBRL2(c.novoPreco)}</td>}
                </tr>
              );
            })}
            <tr className="pl-total">
              <td>TOTAL ({linhas.length})</td>
              <td className="pl-calc-cell">{fmtBRL2(totalCalc)}</td>
              {comCeo && <td className="pl-calc-cell">{fmtBRL2(lucroTotal)}</td>}
              {comCeo && <td className="pl-calc-cell">{algumCeo ? fmtBRL2(lucroNovo) : '—'}</td>}
              {comCeo && <td className="pl-calc-cell">{algumCeo ? (descontoTotal > 0 ? `−${fmtBRL2(descontoTotal)}` : descontoTotal < 0 ? `+${fmtBRL2(-descontoTotal)}` : fmtBRL2(0)) : '—'}</td>}
              {comCeo && <td className="pl-calc-cell">{algumCeo ? fmtBRL2(novoTotal) : '—'}</td>}
            </tr>
          </tbody>
        </table>
      </div>
      {algumCeo && (
        <div className="pl-note" style={{ marginTop: 8 }}>
          Com o líquido que o CEO quer, o preço da proposta passa de <b>{fmtBRL2(totalCalc)}</b> para <b>{fmtBRL2(novoTotal)}</b> ({dinheiroSinal(-descontoTotal)}) e o lucro total fica em <b style={{ color: lucroNovo < 0 ? '#b91c1c' : undefined }}>{fmtBRL2(lucroNovo)}</b> ({fmtPct2(novoTotal > 0 ? lucroNovo / novoTotal : 0)}).
          <div className="small muted" style={{ marginTop: 2 }}>O desconto no preço é um pouco maior que a queda do líquido porque {fmtPct2(1 - m)} de cada R$ do preço vai para impostos e comissões.</div>
          {alav && alav.valido && (
            <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
              <span>Para o cálculo chegar nesse preço: <b>{alav.campo === 'mark_up_pct' ? 'Mark-up' : 'Margem desejada'} = {fmtPct2(alav.valor)}</b>.</span>
              {onAplicar && <Button variant="primary" size="sm" onClick={() => onAplicar(alav.campo, Math.round(alav.valor * 1e6) / 1e6)}>Levar ao cálculo</Button>}
              <span className="small muted">(depois clique em Calcular)</span>
            </div>
          )}
          {alav && !alav.valido && <div style={{ color: '#991b1b', marginTop: 6 }}>⚠ Esse preço fica abaixo do custo + impostos — o cálculo não consegue chegar nele ({alav.campo === 'mark_up_pct' ? 'mark-up' : 'margem'} necessário(a): {fmtPct2(alav.valor)}).</div>}
        </div>
      )}
    </div>
  );
}

/* Sugestão AUTOMÁTICA do frete interno (10/10/2026): cidade da obra (do Formulário)
   × tabela de Frete de Atualização de Custos × nº de containers desta cotação.
   Padrão = caminhão LS (container fechado) da transportadora mais barata; o usuário
   troca transportadora/modalidade ou digita o valor que quiser — nunca sobrescreve
   um valor já digitado, só preenche quando o campo ainda está vazio. */
function PZFreteSugestao({ pz, onUsar }) {
  const CC = window.CadastroCustosStore;
  const [tabela, setTabela] = React.useState([]);
  const [obra, setObra] = React.useState(null);
  const [escolha, setEscolha] = React.useState('');
  const [destinoManual, setDestinoManual] = React.useState('');
  const aplicouRef = React.useRef(false);

  React.useEffect(() => { CC?.listarFrete().then(setTabela); }, []);
  React.useEffect(() => {
    const c = (window.__VP_SB || {}).sb;
    if (!c || !pz.formulario_elevador_id) { setObra({}); return; }
    c.from('formularios_elevador').select('local_obra_cidade, local_obra_estado').eq('id', pz.formulario_elevador_id).single()
      .then(({ data }) => setObra(data ? { cidade: data.local_obra_cidade, uf: data.local_obra_estado } : {}), () => setObra({}));
  }, [pz.formulario_elevador_id]);

  const containers = (pz.containers || []).reduce((s, c) => s + (Number(c.quantidade) || 0), 0);
  const [t, m] = escolha ? escolha.split('-') : [null, null];
  const s = CC && tabela.length
    ? CC.sugerirFrete(tabela, { cidade: destinoManual || (obra && obra.cidade), uf: destinoManual ? null : (obra && obra.uf), containers, transportadora: t, modalidade: m })
    : null;
  const atual = Number(pz.frete_interno_rs) || 0;

  React.useEffect(() => {
    if (aplicouRef.current || !s || !(s.total > 0)) return;
    if (!(atual > 0)) { aplicouRef.current = true; onUsar(s.total); }
  }, [s && s.total]);

  if (!CC || obra === null || !tabela.length) return null;
  const cidadeObra = obra && obra.cidade ? `${obra.cidade}${obra.uf ? '/' + obra.uf : ''}` : null;
  const rotuloOpcao = (o) => `Transportadora ${o.transportadora} · ${o.modalidade === 'LS' ? 'LS (container fechado)' : 'L (carga solta)'} — ${fmtBRL2(o.valor)} por container`;

  return (
    <div className="pl-note" style={{ marginTop: 12 }}>
      <b>Sugestão automática do frete interno</b>
      <span className="muted"> — tabela de Frete (Cadastros → Atualização de Custos) × cidade da obra × containers</span>
      {!s || !s.destino ? (
        <div style={{ marginTop: 6 }}>
          <div>{cidadeObra ? `Não achei "${cidadeObra}" na tabela de frete.` : 'A cotação não informa a cidade da obra.'} Escolha o destino para sugerir:</div>
          <select className="input" style={{ width: 260, marginTop: 6 }} value={destinoManual} onChange={(e) => setDestinoManual(e.target.value)}>
            <option value="">— escolha a capital —</option>
            {tabela.map((l) => <option key={l.id} value={l.destino}>{l.destino}/{l.uf}</option>)}
          </select>
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>
          <div>
            Destino: <b>{s.destino.destino}/{s.destino.uf}</b>
            {s.porUf && <span style={{ color: '#b45309' }}> — a obra é em {cidadeObra}; usei a capital do estado (a tabela só vale até 20 km da capital — confirme com a transportadora)</span>}
          </div>
          <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
            <select className="input" style={{ width: 'min(520px, 100%)', textOverflow: 'ellipsis' }}
              value={s.escolhida ? `${s.escolhida.transportadora}-${s.escolhida.modalidade}` : ''}
              onChange={(e) => setEscolha(e.target.value)}>
              {s.opcoes.map((o) => <option key={`${o.transportadora}-${o.modalidade}`} value={`${o.transportadora}-${o.modalidade}`}>{rotuloOpcao(o)}</option>)}
            </select>
            <span>× <b>{containers}</b> container(es) = <b>{fmtBRL2(s.total)}</b></span>
            <Button variant="primary" size="sm" disabled={!(s.total > 0) || atual === s.total} onClick={() => onUsar(s.total)}>Usar sugestão</Button>
          </div>
          {atual > 0 && atual !== s.total && (
            <div className="small" style={{ marginTop: 6 }}>Valor atual no campo: <b>{fmtBRL2(atual)}</b> (digitado) — a sugestão difere em {fmtBRL2(s.total - atual)}.</div>
          )}
        </div>
      )}
    </div>
  );
}

function PZInput({ value, onChange, type = 'text', placeholder, disabled }) {
  return (
    <input className="input" type={type} value={value ?? ''}
      onChange={(e) => onChange(type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
      placeholder={placeholder} disabled={disabled}/>
  );
}
/* Todo campo "(%)" nesta tela guarda fração (0,175) por baixo — é o
   formato que o motor de cálculo e o banco sempre usaram (ver
   precificacao-elevador-engine.js e o teste de regressão em
   precificacao-elevador-engine.test.js). Mas digitar fração manualmente
   não é como humano pensa em porcentagem, e digitar "22" pensando em
   22% sem perceber que precisava ser "0,22" zerava o preço de venda em
   silêncio (achado real, sessão 27/08 — ver validarAntesDeCalcular/
   markUpForaFaixa mais abaixo). Este input mostra/recebe ponto
   percentual (17,5 = 17,5%) e converte pra fração só na borda — value/
   onChange continuam em fração pro resto do código nem perceber.
   round() evita cauda de ponto flutuante (0.175*100 → 17.499999999999996
   em alguns casos) sem cortar a precisão que essa tela realmente usa. */
function round(n, decimais) { const f = Math.pow(10, decimais); return Math.round(n * f) / f; }
function PZPercentInput({ value, onChange, disabled, placeholder }) {
  const display = value === '' || value === null || value === undefined || Number.isNaN(Number(value)) ? '' : round(Number(value) * 100, 4);
  return (
    <input className="input" type="number" step="0.01" value={display}
      onChange={(e) => onChange(e.target.value === '' ? '' : round(Number(e.target.value) / 100, 6))}
      placeholder={placeholder} disabled={disabled}/>
  );
}
/* Todo campo de "Preço"/valor monetário precisa mostrar o formato da
   própria moeda. BRL usa vírgula decimal + ponto de milhar (R$ 1.234,56,
   padrão brasileiro). USD (pedido explícito do usuário, 28/08: só o
   ponto decimal, sem separador de milhar — "vírgula e ponto não existe")
   usa só ponto decimal e nada mais: US$ 33580.00, não US$ 33,580.00. Em
   vez do número cru que <input type="number"> força (nunca mostra
   símbolo nem 2 casas fixas). Foco = edição crua (facilita apagar/
   digitar); blur = reformata. `value`/onChange continuam número puro
   por baixo (mesmo formato que motor de cálculo e banco sempre
   usaram) — só a exibição muda, igual PZPercentInput fez pra "%".
   window.parseMoeda (utils.js) já é tolerante a "," ou "." como
   decimal, então aceita o que o financeiro digitar. */
function PZCurrencyInput({ value, onChange, moeda = 'BRL', disabled }) {
  const [editando, setEditando] = React.useState(false);
  const [bruto, setBruto] = React.useState('');
  const prefixo = moeda === 'USD' ? 'US$' : 'R$';
  const formatado = moeda === 'USD'
    ? (Number(value) || 0).toFixed(2)
    : (Number(value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg3)', fontSize: 13, pointerEvents: 'none' }}>{prefixo}</span>
      <input className="input" style={{ paddingLeft: 38 }} type="text" inputMode="decimal"
        value={editando ? bruto : formatado}
        onFocus={() => { setBruto(value === '' || value === null || value === undefined ? '' : String(value).replace('.', moeda === 'USD' ? '.' : ',')); setEditando(true); }}
        onChange={(e) => setBruto(e.target.value)}
        onBlur={() => { setEditando(false); onChange(window.parseMoeda(bruto)); }}
        disabled={disabled}/>
    </div>
  );
}
function PZSelect({ value, onChange, options, placeholder }) {
  return (
    <select className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder || '—'}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
// Mesmo vocabulário de tamanhos usado depois no embarque físico (ver
// EI_CONTAINER_TIPOS em embarques-importacao.jsx).
const PZ_CONTAINER_TIPOS = ["20'DV", "40'DV", "40'HC", "20'RF", "40'RF", "20'OT", "40'OT", "20'FR", "40'FR", 'Outro'];

/* ---------- Lista — cotações de fornecedor já respondidas ---------- */
function PrecificacaoElevadorPage({ setRoute, setSubsel, modo, setModo, subsel }) {
  const [pendentes, setPendentes] = React.useState(null);
  /* 23/08 (achado real, Gelson): clicar no nó "Financeiro precificando" da
     Cadeia de Gatilhos caía na lista genérica, não no documento da cotação.
     pzId agora pode nascer do subsel (id de precificacoes_elevador vindo
     do deep-link), não só do clique manual na lista. */
  const [pzId, setPzId] = React.useState(subsel && typeof subsel === 'string' ? subsel : null);

  const carregar = React.useCallback(() => {
    window.PrecificacaoElevadorStore.listarPendentes().then(setPendentes).catch(() => setPendentes([]));
  }, []);
  React.useEffect(() => { carregar(); }, [carregar]);

  /* URL ↔ detalhe (issue #611): abrir/voltar acima gravam o id no `subsel`
     (o App espelha na URL). Este efeito cobre o caminho inverso — Voltar/
     Avançar do navegador mudam o `subsel` por fora: sem ele o detalhe ficava
     aberto com a URL já de volta na lista. Só age quando o `subsel` diverge do
     que a tela mostra (cliques da própria tela e a montagem já batem). */
  const pzIdRef = React.useRef(pzId);
  pzIdRef.current = pzId;
  React.useEffect(() => {
    const novo = subsel && typeof subsel === 'string' ? subsel : null;
    if (novo === pzIdRef.current) return;
    setPzId(novo);
    if (!novo) carregar();
  }, [subsel]);

  const abrir = async (item) => {
    if (item.precificacaoId) { setPzId(item.precificacaoId); setSubsel?.(item.precificacaoId); return; }
    try {
      const pz = await window.PrecificacaoElevadorStore.criar(item.formularioElevadorId, item.cotacaoFornecedorId);
      setPzId(pz.id);
      setSubsel?.(pz.id);
    } catch (e) {
      window.toast?.('Erro ao abrir precificação: ' + e.message, 'error');
    }
  };

  if (pzId) {
    return <PrecificacaoElevadorDetalhe id={pzId} onVoltar={() => {
      setPzId(null);
      /* O App preserva o id da URL quando o subsel vira null na mesma rota (p/
         rotas que usam o 2º segmento como aba) — então limpa a URL antes,
         de forma síncrona; o efeito do App vê a URL já sem id e não a refaz. */
      window.VpRouter?.navigate('precificacao', null);
      setSubsel?.(null);
      carregar();
    }} setRoute={setRoute} setSubsel={setSubsel}/>;
  }

  return (
    <div className="page fade-in pl">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro · Precificação</div>
          <h1 className="page-head__title">Precificação — Equipamentos</h1>
          <p className="page-head__sub">Cotações já respondidas pelo fornecedor, ou formulários enviados direto (preço já combinado por fora) — prontas para calcular o preço de venda.</p>
        </div>
        <div className="page-head__r"><PrecificacaoModoTabs modo={modo} setModo={setModo}/></div>
      </div>

      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Cotação Nº</th><th>Cliente</th><th>Fornecedor</th><th>Respondido em</th><th>Decisão de compra</th><th>Precificação</th><th></th></tr></thead>
          <tbody>
            {pendentes === null && (
              <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</td></tr>
            )}
            {pendentes !== null && pendentes.length === 0 && (
              <tr><td colSpan={99} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg3)', fontSize: 13 }}>Nenhuma cotação respondida nem formulário enviado direto ainda.</td></tr>
            )}
            {(pendentes || []).map((item) => (
              <tr key={item.cotacaoFornecedorId || ('direto-' + item.formularioElevadorId)} style={{ cursor: 'pointer' }} onClick={() => abrir(item)}>
                <td className="mono">{item.numeroCotacao ?? '—'}</td>
                <td>{item.clienteNome || '—'}</td>
                <td>{item.direto ? <span className="small" title="Preço combinado por fora — sem Cotação a Fornecedor">Direto (sem fornecedor)</span> : item.fornecedor}</td>
                <td>{item.respondedAt ? new Date(item.respondedAt).toLocaleDateString('pt-BR') : '—'}</td>
                <td>{item.direto ? <span className="muted small">—</span> : <StatusBadge status={window.CotacaoElevadorFornecedorStore.statusGroupLabel(item.statusCotacao)}/>}</td>
                <td>{item.precificacaoStatus ? <StatusBadge status={item.precificacaoStatus === 'finalizado' ? 'Aprovada' : item.precificacaoStatus === 'calculado' ? 'Em análise' : 'Recebida'}/> : <span className="muted small">Não iniciada</span>}</td>
                <td><Button variant="ghost" size="sm" icon="chevRight" title="Abrir" aria-label="Abrir">Abrir</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* 28/09 — pedido do usuário: depois que a Proposta já foi enviada, o
   cliente às vezes pede pra acrescentar mais equipamentos (idênticos ou
   com specs diferentes) ao pedido. `grupos` é 1 opção por Unidade já
   cotada nesta Precificação (real ou já acrescentada antes), pra "igual
   a este" oferecer a lista certa. */
function ModalAcrescentarEquipamento({ grupos, onClose, onConfirmar }) {
  const [modo, setModo] = React.useState(grupos.length ? 'identico' : 'novo');
  const [unidadeId, setUnidadeId] = React.useState((grupos[0] || {}).unidadeId || '');
  const [quantidade, setQuantidade] = React.useState(1);
  const [tracao, setTracao] = React.useState('');
  const [capacidadeKg, setCapacidadeKg] = React.useState('');
  const [paradas, setParadas] = React.useState('');
  const [modelo, setModelo] = React.useState('');
  const [salvando, setSalvando] = React.useState(false);

  const valido = modo === 'identico' ? !!unidadeId && Number(quantidade) > 0
    : Number(quantidade) > 0; // equipamento novo pode nascer sem tração/capacidade/paradas ainda (mesma regra de "pendente" da tabela)

  const confirmar = async () => {
    if (!valido || salvando) return;
    setSalvando(true);
    try {
      await onConfirmar(modo === 'identico'
        ? { modo: 'identico', unidadeId, quantidadeAdicional: quantidade }
        : { modo: 'novo', tracao: tracao || null, capacidadeKg, paradas, modelo, quantidadeAdicional: quantidade });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal title="Acrescentar equipamento" onClose={onClose} width={520}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={salvando}>Cancelar</Button>
        <Button variant="primary" onClick={confirmar} disabled={!valido || salvando}>{salvando ? 'Acrescentando…' : 'Acrescentar'}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <p className="small muted" style={{ margin: 0 }}>Só entra nesta Precificação (mão de obra e totais) — não altera as Unidades do Formulário de Elevadores original.</p>
        <div className="stack" style={{ gap: 6 }}>
          <label className="row gap-2" style={{ alignItems: 'center' }}>
            <input type="radio" checked={modo === 'identico'} disabled={!grupos.length} onChange={() => setModo('identico')}/>
            <span>Idêntico a um equipamento já cotado</span>
          </label>
          <label className="row gap-2" style={{ alignItems: 'center' }}>
            <input type="radio" checked={modo === 'novo'} onChange={() => setModo('novo')}/>
            <span>Equipamento novo (especificações diferentes)</span>
          </label>
        </div>

        {modo === 'identico' && (
          <PZField label="Igual a">
            <select className="input" value={unidadeId} onChange={(e) => setUnidadeId(e.target.value)}>
              {grupos.map((g) => (
                <option key={g.unidadeId} value={g.unidadeId}>
                  {g.identificador} — {g.tracao || '?'} × {g.capacidadeKg != null ? `${g.capacidadeKg}kg` : '?'} × {g.paradas != null ? `${g.paradas} paradas` : '?'}
                </option>
              ))}
            </select>
          </PZField>
        )}

        {modo === 'novo' && (
          <div className="grid-3" style={{ gap: 12 }}>
            <PZField label="Tração">
              <select className="input" value={tracao} onChange={(e) => setTracao(e.target.value)}>
                <option value="">— selecione —</option>
                {PZ_TRACOES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </PZField>
            <PZField label="Capacidade (kg)"><PZInput type="number" value={capacidadeKg} onChange={setCapacidadeKg}/></PZField>
            <PZField label="Paradas"><PZInput type="number" value={paradas} onChange={setParadas}/></PZField>
            <PZField span={3} label="Modelo (opcional)"><PZInput value={modelo} onChange={setModelo}/></PZField>
          </div>
        )}

        <PZField label="Quantidade de equipamentos a acrescentar">
          <input className="input" type="number" min="1" style={{ width: 120 }} value={quantidade}
            onChange={(e) => setQuantidade(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}/>
        </PZField>
      </div>
    </Modal>
  );
}

/* Aviso "vendedor está ciente" pedido pelo usuário — nunca exclui sem
   confirmação explícita. `mo` é a linha física clicada.

   29/09 — corrigido depois de um achado real na cotação Nº 962: a versão
   anterior deste modal ("Remover equipamento?") decrementava a quantidade
   cotada — o equipamento inteiro (com seu custo de mercadoria) sumia da
   tabela "Unidades desta cotação"/VMLE e da Proposta, não só da Mão de
   obra. O pedido real da Juliana era só excluir a Mão de obra de um
   equipamento cuja instalação não é por conta da VerticalParts (terceiro
   cuida da montagem) — o equipamento em si continua sendo vendido/
   importado normalmente. Este modal (e removerEquipamento) NUNCA mais
   mexe na quantidade — só marca a Mão de obra deste equipamento como
   excluída do cálculo. */
function ModalRemoverEquipamento({ mo, onClose, onConfirmar }) {
  const [ciente, setCiente] = React.useState(false);
  const [removendo, setRemovendo] = React.useState(false);

  const confirmar = async () => {
    if (!ciente || removendo) return;
    setRemovendo(true);
    try { await onConfirmar(); } finally { setRemovendo(false); }
  };

  return (
    <Modal title="Excluir Mão de obra deste equipamento?" onClose={onClose} width={520}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={removendo}>Cancelar</Button>
        <Button variant="danger" onClick={confirmar} disabled={!ciente || removendo}>{removendo ? 'Excluindo…' : 'Sim, excluir a Mão de obra'}</Button>
      </>}>
      <div className="stack" style={{ gap: 12 }}>
        <div style={{ background: 'var(--vp-gray-50)', border: '1px solid var(--border)', padding: '12px 14px' }}>
          <div style={{ fontWeight: 700 }}>{mo.identificador || '—'}</div>
          <div className="cell-sub" style={{ marginTop: 4 }}>{mo.tracao || '?'} × {mo.capacidadeKg != null ? `${mo.capacidadeKg}kg` : '?'} × {mo.paradas != null ? `${mo.paradas} paradas` : '?'}</div>
        </div>
        <p className="small" style={{ margin: 0 }}>
          Use isso quando a instalação deste equipamento <b>não é por conta da VerticalParts</b> (ex.: terceiro cuida da montagem). O valor de Mão de obra (R$ {mo.valorRs ? fmtBRL2(mo.valorRs) : '0,00'}) sai do total de "Instalação e Montagem".
        </p>
        <p className="small" style={{ margin: 0, fontWeight: 600 }}>
          O equipamento continua normalmente na cotação — isso NÃO reduz a quantidade nem mexe em "Unidades desta cotação"/VMLE/Proposta. Dá pra desfazer depois clicando em "Devolver ao cálculo".
        </p>
        <label className="row gap-2" style={{ alignItems: 'flex-start' }}>
          <input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} style={{ marginTop: 2 }}/>
          <span className="small">Estou ciente e tenho certeza de que a Mão de obra deste equipamento deve ser excluída do cálculo.</span>
        </label>
      </div>
    </Modal>
  );
}

/* ---------- Detalhe — motor de cálculo ---------- */
function PrecificacaoElevadorDetalhe({ id, onVoltar, setRoute, setSubsel }) {
  const [pz, setPz] = React.useState(null);
  const [calculando, setCalculando] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [aprovando, setAprovando] = React.useState(false);
  const [mostrarParametros, setMostrarParametros] = React.useState(false);
  const [mostrarObrigatorios, setMostrarObrigatorios] = React.useState(false); // células obrigatórias acendem depois de uma tentativa de Calcular
  const [ressincronizando, setRessincronizando] = React.useState(false);
  const [atualizandoMo, setAtualizandoMo] = React.useState(false);
  const [editandoMoUnidade, setEditandoMoUnidade] = React.useState(null);
  const [moSpecEdit, setMoSpecEdit] = React.useState({ tracao: '', capacidadeKg: '', paradas: '' });
  const [mostrarAcrescentarEquipamento, setMostrarAcrescentarEquipamento] = React.useState(false);
  const [removendoEquipamento, setRemovendoEquipamento] = React.useState(null); // mo (linha) sendo removida, pro modal de confirmação
  // Câmbio USD/BRL ao vivo — só referência/comparação (ver cambio-api.js).
  // Não substitui tx_cambial sozinho; o Financeiro aplica clicando "Usar".
  const [cambioVivo, setCambioVivo] = React.useState(null); // null | { valor, timestamp } | 'erro'
  // Containers de Cadastros → Atualização de Custos — só pra herdar o
  // Preço(R$) quando o Financeiro escolhe/troca o tipo/tamanho aqui (ver
  // buscarContainerCustoPorIso em precificacao-elevador-store.js).
  const [custosContainers, setCustosContainers] = React.useState([]);

  const carregar = React.useCallback(() => {
    window.PrecificacaoElevadorStore.obter(id).then(async (data) => {
      const norm = pzNormalizarItensInstalacao(data);
      // 28/09 — achado real (Gelson): a herança de Preço(R$) de Atualização
      // de Custos (buscarContainerCustoPorIso/enriquecerContainersComCusto)
      // só rodava ao MONTAR um rascunho novo (montarRascunho). Uma
      // precificação já salva antes desta feature — ou salva com container
      // sem preço por qualquer motivo — nunca passava por ali de novo, só
      // ficava R$ 0,00 pra sempre. Reaplica aqui, toda vez que a tela
      // carrega, pros containers que ainda não têm preço nenhum — nunca
      // sobrescreve um valor já digitado (mesma regra de sempre).
      // 01/10/2026: a capatazia herda do cadastro com a mesma regra (só se ainda vazia).
      if ((norm.containers || []).some((c) => !(Number(c.preco_rs) > 0) || !(Number(c.capatazia_rs) > 0) || !(Number(c.gri_rs) > 0))) {
        const custos = await window.CadastroCustosStore?.listarContainers();
        norm.containers = window.PrecificacaoElevadorStore.enriquecerContainersComCusto(norm.containers, custos);
      }
      setPz(norm);
    });
  }, [id]);
  React.useEffect(() => { carregar(); }, [carregar]);
  React.useEffect(() => {
    window.CambioAPI.buscarUsdBrl().then(setCambioVivo).catch(() => setCambioVivo('erro'));
  }, []);
  React.useEffect(() => { window.CadastroCustosStore?.listarContainers().then(setCustosContainers); }, []);

  const ressincronizarDoFornecedor = async () => {
    setRessincronizando(true);
    try {
      /* 15/09 — achado real (auditoria do tour.md): antes esta ação
         sobrescrevia modelo/valor das unidades sem avisar, mesmo quando o
         Financeiro tinha corrigido manualmente na tela. Agora faz um
         dry-run primeiro, mostra exatamente o que vai mudar e só grava
         depois de confirmação explícita. */
      const preview = await window.PrecificacaoElevadorStore.ressincronizarDoFornecedor(pz.id, { dryRun: true });
      if (!preview.diffs.length) {
        window.toast?.('Já está sincronizado — nada mudou.', 'info');
        return;
      }
      const linhas = preview.diffs.map((d) => d.unidadeId
        ? `• Unidade ${d.unidadeId}: modelo "${d.de.modelo || '—'}" → "${d.para.modelo || '—'}", valor US$ ${d.de.valorUnitarioUsd ?? 0} → US$ ${d.para.valorUnitarioUsd ?? 0}`
        : `• VMLE total: US$ ${d.de.vmle_usd ?? 0} → US$ ${d.para.vmle_usd ?? 0}`);
      const ok = window.confirm('Isso vai sobrescrever os seguintes valores (incluindo eventuais correções manuais já feitas):\n\n' + linhas.join('\n') + '\n\nConfirmar ressincronização?');
      if (!ok) return;
      await window.PrecificacaoElevadorStore.ressincronizarDoFornecedor(pz.id, { dryRun: false });
      await carregar();
      window.toast?.('Valores do fornecedor ressincronizados.', 'success');
    } catch (e) {
      window.toast?.('Erro ao ressincronizar: ' + e.message, 'error');
    } finally {
      setRessincronizando(false);
    }
  };

  const atualizarMaoDeObra = async () => {
    setAtualizandoMo(true);
    try {
      await window.PrecificacaoElevadorStore.atualizarMaoDeObra(pz.id);
      await carregar();
      window.toast?.('Mão de obra recalculada a partir da tabela de referência.', 'success');
    } catch (e) {
      window.toast?.('Erro ao recalcular mão de obra: ' + e.message, 'error');
    } finally {
      setAtualizandoMo(false);
    }
  };

  /* Edição inline de tração/capacidade/paradas direto na tabela de MO —
     usuário pode ter escolhido a tração errada, ou querer testar outra
     capacidade/paradas pra ver se cai dentro da cobertura da tabela, sem
     sair da Precificação pra editar no Formulário. Escreve na fonte da
     verdade (formularios_elevador_unidades, mesma tabela que o Formulário
     edita) e reusa atualizarMaoDeObra() pra re-classificar com o dado
     novo — nunca guarda uma cópia divergente aqui. */
  const salvarSpecUnidade = async (unidadeId) => {
    setAtualizandoMo(true);
    try {
      await window.FormularioElevadorStore.atualizarUnidade(unidadeId, {
        tracao: moSpecEdit.tracao || null,
        capacidade_kg: moSpecEdit.capacidadeKg === '' ? null : Number(moSpecEdit.capacidadeKg),
        paradas: moSpecEdit.paradas === '' ? null : Number(moSpecEdit.paradas),
      });
      await window.PrecificacaoElevadorStore.atualizarMaoDeObra(pz.id);
      await carregar();
      setEditandoMoUnidade(null);
      window.toast?.('Especificação atualizada — mão de obra recalculada.', 'success');
    } catch (e) {
      window.toast?.('Erro ao salvar: ' + e.message, 'error');
    } finally {
      setAtualizandoMo(false);
    }
  };

  /* 28/09 — pedido do usuário: depois que a Proposta já foi enviada, o
     cliente às vezes pede pra acrescentar ou remover equipamento(s). Nunca
     mexe na Unidade real do Formulário (diferente de "Trocar" acima) — só
     no snapshot pz.modelos desta Precificação, ver comentário em
     acrescentarEquipamento/removerEquipamento (precificacao-elevador-store.js). */
  const acrescentarEquipamento = async (patch) => {
    setAtualizandoMo(true);
    try {
      await window.PrecificacaoElevadorStore.acrescentarEquipamento(pz.id, patch);
      await carregar();
      setMostrarAcrescentarEquipamento(false);
      window.toast?.('Equipamento acrescentado — mão de obra recalculada.', 'success');
    } catch (e) {
      window.toast?.('Erro ao acrescentar equipamento: ' + e.message, 'error');
    } finally {
      setAtualizandoMo(false);
    }
  };

  const removerEquipamento = async (unidadeId) => {
    setAtualizandoMo(true);
    try {
      await window.PrecificacaoElevadorStore.removerEquipamento(pz.id, unidadeId);
      await carregar();
      setRemovendoEquipamento(null);
      window.toast?.('Mão de obra excluída — o equipamento continua na cotação.', 'success');
    } catch (e) {
      window.toast?.('Erro ao excluir Mão de obra: ' + e.message, 'error');
    } finally {
      setAtualizandoMo(false);
    }
  };

  const devolverEquipamentoMO = async (unidadeId) => {
    setAtualizandoMo(true);
    try {
      await window.PrecificacaoElevadorStore.restaurarEquipamentoMO(pz.id, unidadeId);
      await carregar();
      window.toast?.('Equipamento devolvido pro cálculo normal de Mão de obra.', 'success');
    } catch (e) {
      window.toast?.('Erro ao devolver equipamento: ' + e.message, 'error');
    } finally {
      setAtualizandoMo(false);
    }
  };

  if (!pz) return <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg3)', fontSize: 13 }}>Carregando…</div>;

  const set = (k) => (v) => setPz((p) => ({ ...p, [k]: v }));
  const setParam = (k) => (v) => setPz((p) => ({ ...p, parametros_fiscais_snapshot: { ...p.parametros_fiscais_snapshot, [k]: v } }));
  const setModelo = (i, k) => (v) => setPz((p) => {
    const arr = [...(p.modelos || [])];
    arr[i] = { ...arr[i], [k]: v };
    return { ...p, modelos: arr };
  });

  const setItemInstalacao = (i, k) => (v) => setPz((p) => {
    const arr = [...(p.itens_instalacao_montagem || [])];
    arr[i] = { ...arr[i], [k]: v };
    return { ...p, itens_instalacao_montagem: arr };
  });

  const addContainer = () => setPz((p) => ({ ...p, containers: [...(p.containers || []), { tipo_tamanho: '', quantidade: 1, preco_rs: 0 }] }));
  const setContainer = (i, k) => (v) => setPz((p) => {
    const arr = [...(p.containers || [])];
    const linha = { ...arr[i], [k]: v };
    // Trocar o tipo/tamanho herda o Preço(R$) de Atualização de Custos —
    // só quando ainda não tem preço nenhum (não sobrescreve valor que o
    // Financeiro já digitou na mão pra essa linha).
    if (k === 'tipo_tamanho') {
      const custo = window.PrecificacaoElevadorStore.buscarContainerCustoPorIso(v, custosContainers);
      if (custo && !(Number(linha.preco_rs) > 0)) linha.preco_rs = Number(custo.preco_rs) || 0;
      if (custo && !(Number(linha.capatazia_rs) > 0) && Number(custo.capatazia_rs) > 0) linha.capatazia_rs = Number(custo.capatazia_rs);
      if (custo && !(Number(linha.gri_rs) > 0) && Number(custo.gri_rs) > 0) linha.gri_rs = Number(custo.gri_rs);
    }
    arr[i] = linha;
    return { ...p, containers: arr };
  });
  const removeContainer = (i) => setPz((p) => ({ ...p, containers: (p.containers || []).filter((_, idx) => idx !== i) }));
  const containersTotalRs = (pz.containers || []).reduce((s, c) => s + (Number(c.quantidade) || 0) * (Number(c.preco_rs) || 0), 0);
  const capataziaTotalRs = (pz.containers || []).reduce((s, c) => s + (Number(c.quantidade) || 0) * (Number(c.capatazia_rs) || 0), 0);
  const griTotalRs = (pz.containers || []).reduce((s, c) => s + (Number(c.quantidade) || 0) * (Number(c.gri_rs) || 0), 0);
  // Aviso (não bloqueia) quando container/capatazia divergem do cadastro de Containers.
  const divergenciasContainer = window.PrecificacaoElevadorStore.divergenciasContainerComCadastro(pz.containers, custosContainers);

  const addItemExtra = () => setPz((p) => ({ ...p, itens_despesas_extras: [...(p.itens_despesas_extras || []), { descricao: '', valor: 0 }] }));
  const setItemExtra = (i, k) => (v) => setPz((p) => {
    const arr = [...(p.itens_despesas_extras || [])];
    arr[i] = { ...arr[i], [k]: v };
    return { ...p, itens_despesas_extras: arr };
  });
  const removeItemExtra = (i) => setPz((p) => ({ ...p, itens_despesas_extras: (p.itens_despesas_extras || []).filter((_, idx) => idx !== i) }));

  const payloadSalvar = () => ({
    vmle_usd: pz.vmle_usd, seguro_usd: pz.seguro_usd, frete_seguro_capatazia_usd: pz.frete_seguro_capatazia_usd,
    siscomex_rs: pz.siscomex_rs, tx_cambial: pz.tx_cambial, cambio_base: pz.cambio_base ?? null, cambio_spread_pct: pz.cambio_spread_pct ?? null, outras_despesas_importacao_rs: pz.outras_despesas_importacao_rs,
    despachante_desembaraco_rs: pz.despachante_desembaraco_rs, demurrage_rs: pz.demurrage_rs,
    frete_interno_rs: pz.frete_interno_rs, armazenagem_rs: pz.armazenagem_rs,
    itens_instalacao_montagem: pz.itens_instalacao_montagem, containers: pz.containers,
    itens_despesas_extras: pz.itens_despesas_extras, percentual_servicos: pz.percentual_servicos,
    modelos: pz.modelos, parametros_fiscais_snapshot: pz.parametros_fiscais_snapshot,
    mark_up_pct: pz.mark_up_pct, mark_up_pct_expresso: pz.mark_up_pct_expresso ?? null, comissao_consultoria_pct: pz.comissao_consultoria_pct,
    comissao_vendedor_pct: pz.comissao_vendedor_pct, comissao_indicacao_pct: pz.comissao_indicacao_pct,
    modo_formacao_preco: 'planilha', margem_desejada_pct: pz.margem_desejada_pct,
    contingencia_valor: pz.contingencia_valor, outros_custos_nao_recuperaveis_rs: pz.outros_custos_nao_recuperaveis_rs,
    valores_sugeridos_ceo: pz.valores_sugeridos_ceo || {},
  });

  const salvar = async () => {
    setSalvando(true);
    try { await window.PrecificacaoElevadorStore.salvar(pz.id, payloadSalvar()); window.toast?.('Rascunho salvo.', 'success'); }
    catch (e) { window.toast?.('Erro ao salvar: ' + e.message, 'error'); }
    finally { setSalvando(false); }
  };

  /* Travas de sanidade — garante-lixo-em-garante-lixo-fora catastrófico.
     O câmbio (R$/US$) é o multiplicador de todo o custo importado; um valor
     fora da faixa real (ex.: 678,91 digitado no lugar de 5,50) explode a
     proposta pra dezenas de milhões sem nenhum aviso. */
  const CAMBIO_MIN = 1, CAMBIO_MAX = 20;
  /* 10/10/2026 — pedido do usuário: toda célula obrigatória acende se não foi preenchida.
     Comissão de consultoria (Financeiro) passa a ser obrigatória: o Financeiro digita de 0% a 5% — 0 vale, vazio não. */
  const CONSULTORIA_MAX = 0.05;
  const vazio = (v) => v === null || v === undefined || v === '' || Number.isNaN(Number(v));
  const obrig = {
    tx_cambial: !(Number(pz.tx_cambial) > 0),
    vmle_usd: !(Number(pz.vmle_usd) > 0),
    mark_up_pct: vazio(pz.mark_up_pct),
    comissao_consultoria_pct: vazio(pz.comissao_consultoria_pct) || Number(pz.comissao_consultoria_pct) < 0 || Number(pz.comissao_consultoria_pct) > CONSULTORIA_MAX + 1e-9,
    comissao_vendedor_pct: !(Number(pz.comissao_vendedor_pct) > 0),
  };
  const f = (k) => mostrarObrigatorios && obrig[k];
  const validarAntesDeCalcular = () => {
    const nomes = { tx_cambial: 'Câmbio', vmle_usd: 'VMLE (USD)', mark_up_pct: 'Mark-up', comissao_consultoria_pct: 'Comissão de consultoria (0 a 5%)', comissao_vendedor_pct: 'Comissão do vendedor' };
    const faltam = Object.keys(obrig).filter((k) => obrig[k]);
    if (faltam.length) {
      setMostrarObrigatorios(true);
      window.toast?.(`Preencha os campos obrigatórios (destacados em vermelho): ${faltam.map((k) => nomes[k]).join(', ')}.`, 'warning');
      return false;
    }
    const cambio = Number(pz.tx_cambial) || 0;
    if (cambio <= 0) { window.toast?.('Informe o Câmbio (R$/US$) antes de calcular.', 'warning'); return false; }
    if (cambio < CAMBIO_MIN || cambio > CAMBIO_MAX) {
      window.toast?.(`Câmbio ${cambio} fora da faixa esperada (${CAMBIO_MIN}–${CAMBIO_MAX} R$/US$). Verifique — parece que um valor de outro campo (taxa/frete) foi digitado no Câmbio.`, 'error');
      return false;
    }
    if ((Number(pz.vmle_usd) || 0) <= 0) { window.toast?.('VMLE (USD) precisa ser maior que zero.', 'warning'); return false; }
    /* Mark-up ≥ 100% é implausível pra esse negócio e sempre zera o preço
       de venda (K65_precoVendaPct = 1 - impostos - markUp fica ≤ 0) — fica
       como trava de sanidade mesmo com o campo já em ponto percentual
       (PZPercentInput), pra pegar dado antigo já salvo errado de antes
       dessa conversão, ou um "100" digitado por engano (achado real,
       sessão 27/08). */
    if (markUpForaFaixa) {
      window.toast?.(`Mark-up de ${fmtPct2(pz.mark_up_pct)} é implausível e zera o preço de venda calculado. Confira o valor.`, 'error');
      return false;
    }
    return true;
  };

  const calcular = async () => {
    if (!validarAntesDeCalcular()) return;
    setCalculando(true);
    try {
      await window.PrecificacaoElevadorStore.salvar(pz.id, payloadSalvar());
      await window.PrecificacaoElevadorStore.calcularEsalvar(pz.id);
      await carregar();
      window.toast?.('Cálculo atualizado.', 'success');
    } catch (e) {
      window.toast?.('Erro ao calcular: ' + e.message, 'error');
    } finally {
      setCalculando(false);
    }
  };

  /* 10/10/2026 — Dólar do cálculo = PTAX escolhida (do dia da cotação OU de agora) × (1 + % sobre o dólar).
     O resultado alimenta o campo "Câmbio (R$/US$)" (tx_cambial), que é o que o motor usa. */
  const ptaxCotacaoNum = Number(pz.cambio_na_cotacao_usd_brl) > 0 ? Number(pz.cambio_na_cotacao_usd_brl) : null;
  const ptaxAgoraNum = cambioVivo && cambioVivo !== 'erro' ? Number(cambioVivo.valor) : null;
  const cambioBase = pz.cambio_base || null; // null = o Câmbio está como foi digitado (nenhuma PTAX marcada ainda)
  const baseParaPercentual = cambioBase || (ptaxCotacaoNum ? 'cotacao' : 'agora');
  const cambioSpread = Number(pz.cambio_spread_pct) || 0;
  const ptaxBaseValor = cambioBase === 'cotacao' ? ptaxCotacaoNum : cambioBase === 'agora' ? ptaxAgoraNum : null;
  const dolarAplicado = ptaxBaseValor ? round(ptaxBaseValor * (1 + cambioSpread), 4) : null;
  const dolarDoCalculo = dolarAplicado != null ? dolarAplicado : (Number(pz.tx_cambial) || null);
  const cambioDoUltimoCalculo = (pz.resultado_v2 && pz.resultado_v2.importacao && Number(pz.vmle_usd) > 0 && Number(pz.resultado_v2.importacao.vmleRs) > 0)
    ? Number(pz.resultado_v2.importacao.vmleRs) / Number(pz.vmle_usd) : null;
  const precoDesatualizado = cambioDoUltimoCalculo != null && Number(pz.tx_cambial) > 0 && Math.abs(cambioDoUltimoCalculo - Number(pz.tx_cambial)) > 0.00005;
  const fmtDolar = (v) => (v == null ? '—' : 'R$ ' + Number(v).toFixed(4).replace('.', ','));
  const aplicarDolar = (base, spread) => {
    const bv = base === 'cotacao' ? ptaxCotacaoNum : ptaxAgoraNum;
    const sp = spread === '' || spread == null ? 0 : Number(spread);
    setPz((p) => ({ ...p, cambio_base: base, cambio_spread_pct: spread === '' ? null : spread, ...(bv ? { tx_cambial: round(bv * (1 + sp), 4) } : {}) }));
  };

  const resultado = pz.resultado && pz.resultado.precificacao;
  const resultadoV2 = pz.resultado_v2 && pz.resultado_v2.precificacao ? pz.resultado_v2 : null;
  const margemEfetivaV2Negativa = !!resultadoV2 && resultadoV2.precificacao.margemEfetivaPct < 0;
  const resultadoV2Expresso = pz.resultado_v2_expresso && pz.resultado_v2_expresso.precificacao ? pz.resultado_v2_expresso : null;
  // Mesma soma usada em calcularEsalvar() (precificacao-elevador-store.js) pra
  // formar quantidadeEquipamentos — reaproveitada aqui só pra exibir "× N"
  // ao lado do preço por equipamento, sem recalcular nada do motor.
  const quantidadeEquipamentos = (pz.modelos || []).reduce((s, m) => s + (Number(m.quantidade) || 0), 0) || 1;
  /* Regra do Financeiro (01/10): 2 cards (120d compartilhado × 90d exclusivo)
     só com UM equipamento — importar 1 equipamento sozinho em 90 dias não
     compensa o frete, então vale a comparação. Com 2+ o container já é
     compartilhado: só o card base (120d), sem citar prazo. */
  const mostrarExpresso = !!resultadoV2Expresso && quantidadeEquipamentos <= 1;
  const difal = pz.difal && pz.difal.mensagem ? pz.difal : null;
  const params = pz.parametros_fiscais_snapshot || {};
  const margemMinima = Number(params.margem_minima_pct) || 0;
  // V2 é o motor oficial (decisão 29/08) — a trava de aprovação usa a
  // margem dele; cai pro V1 só quando ainda não existe resultado_v2
  // (precificação nunca recalculada desde a migração).
  const margemOficialPct = pz.resultado_v2 && pz.resultado_v2.precificacao ? pz.resultado_v2.precificacao.margemEfetivaPct : (resultado ? resultado.margemFinalPct : null);
  const margemAbaixoMinima = margemOficialPct != null && margemOficialPct < margemMinima;
  const aprovado = pz.status === 'finalizado';

  const aprovar = async (forcar) => {
    setAprovando(true);
    try {
      await window.PrecificacaoElevadorStore.aprovar(pz.id, { forcarAbaixoMinima: forcar });
      await carregar();
      window.toast?.('Precificação aprovada.', 'success');
    } catch (e) {
      if (e.margemAbaixoMinima) {
        if (window.confirm(`${e.message}\n\nAprovar mesmo assim?`)) return aprovar(true);
      } else {
        window.toast?.('Erro ao aprovar: ' + e.message, 'error');
      }
    } finally {
      setAprovando(false);
    }
  };

  const cambioNum = Number(pz.tx_cambial) || 0;
  const cambioForaFaixa = cambioNum > 0 && (cambioNum < CAMBIO_MIN || cambioNum > CAMBIO_MAX);
  /* Mark-up ≥ 100% é implausível pra esse negócio e sempre zera o preço de
     venda (K65_precoVendaPct = 1 - impostos - markUp fica ≤ 0) — sintoma
     visível era "Margem final 0,00% abaixo da mínima", sem apontar a causa
     real (achado real, sessão 27/08). Todo campo "(%)" agora é digitado em
     ponto percentual (PZPercentInput), então isso só deveria disparar com
     dado antigo salvo de antes dessa mudança, ou erro de digitação grosseiro. */
  const markUpForaFaixa = Number(pz.mark_up_pct) >= 1;
  // resultado implausível: preço-venda muito acima do custo esperado do FOB (FOB USD × câmbio).
  const fobBrlEsperado = (Number(pz.vmle_usd) || 0) * cambioNum;
  const resultadoImplausivel = !!resultadoV2 && (cambioForaFaixa || markUpForaFaixa || (fobBrlEsperado > 0 && Number(resultadoV2.precificacao.precoVendaProposta) > fobBrlEsperado * 50));

  return (
    <div className="page fade-in pl">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Financeiro · Precificação</div>
          <h1 className="page-head__title">{pz.numero_documento}</h1>
          <div className="row gap-2" style={{ marginTop: 6 }}>
            <div className="mono" style={{ display: 'inline-flex', background: '#111', color: '#FBB039', fontWeight: 700, padding: '6px 12px', borderRadius: 6, fontSize: 13 }}>
              Cotação Nº {pz.numero_cotacao ?? '—'}
            </div>
            <div className="mono small muted" style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 0' }}>
              Precificação {pz.numero_documento}
            </div>
          </div>
        </div>
        <div className="page-head__r">
          <Button variant="ghost" icon="chevLeft" onClick={onVoltar}>Voltar</Button>
          <Button variant="outline" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar rascunho'}</Button>
          <Button variant="primary" icon="calculator" onClick={calcular} disabled={calculando}>{calculando ? 'Calculando…' : 'Calcular'}</Button>
          {resultado && !aprovado && (
            <Button variant="outline" icon="check" onClick={() => aprovar(false)} disabled={aprovando}>{aprovando ? 'Aprovando…' : 'Aprovar precificação'}</Button>
          )}
          {aprovado && (
            <span className="badge" style={{ background: 'var(--vp-success)', color: '#fff', display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
              ✓ Aprovada {pz.aprovado_em ? `em ${new Date(pz.aprovado_em).toLocaleDateString('pt-BR')}` : ''}
            </span>
          )}
          {resultado && !aprovado && <span className="muted small" style={{ display: 'inline-flex', alignItems: 'center', padding: '0 4px' }}>Calculado — aprove antes de gerar a proposta</span>}
        </div>
      </div>

      {(cambioForaFaixa || resultadoImplausivel) && (
        <div style={{ margin: '0 0 16px', padding: '12px 16px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, color: '#991b1b', fontSize: 13 }}>
          <b>⚠ Verifique os valores antes de enviar.</b>{' '}
          {cambioForaFaixa
            ? `O Câmbio informado é ${cambioNum} R$/US$ — fora da faixa real (${CAMBIO_MIN}–${CAMBIO_MAX}). Provável troca de campo (taxa/frete digitados no Câmbio). Corrija o Câmbio e recalcule.`
            : markUpForaFaixa
            ? `Mark-up de ${fmtPct2(pz.mark_up_pct)} é implausível — isso zera o preço de venda calculado. Confira o valor.`
            : `O preço de venda calculado (${fmtBRL2(resultadoV2.precificacao.precoVendaProposta)}) está muito acima do custo esperado do FOB (${fmtBRL2(fobBrlEsperado)}). Confira câmbio, mark-up e percentuais.`}
        </div>
      )}

      <Card title="Unidades desta cotação" sub="herdado do Formulário de Elevadores + resposta do fornecedor"
        action={pz.cotacao_fornecedor_id && (
          <Button variant="outline" size="sm" icon="refresh" onClick={ressincronizarDoFornecedor} disabled={ressincronizando}>
            {ressincronizando ? 'Ressincronizando…' : 'Ressincronizar do fornecedor'}
          </Button>
        )}>
        <div className="table-wrap">
          <table className="t">
            <thead><tr>
              <th>UNIDADE</th><th>Modelo (fornecedor)</th><th>Quantidade</th>
              <th style={{ minWidth: 110 }} title="Percentual somado ao dólar escolhido ao lado (ex.: 3% eleva o dólar em 3%). O resultado vira o Câmbio do cálculo.">
                <div>% sobre o dólar</div>
                <PZPercentInput value={pz.cambio_spread_pct ?? ''} onChange={(v) => aplicarDolar(baseParaPercentual, v)} placeholder="0"/>
              </th>
              <th title="Marque qual dólar vale para o cálculo.">
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: ptaxCotacaoNum ? 'pointer' : 'not-allowed' }}>
                  <input type="radio" name="pz-cambio-base" checked={cambioBase === 'cotacao'} disabled={!ptaxCotacaoNum} onChange={() => aplicarDolar('cotacao', pz.cambio_spread_pct ?? '')}/>
                  (USD) PTAX No dia da Cotação
                </label>
              </th>
              <th title="Marque qual dólar vale para o cálculo.">
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: ptaxAgoraNum ? 'pointer' : 'not-allowed' }}>
                  <input type="radio" name="pz-cambio-base" checked={cambioBase === 'agora'} disabled={!ptaxAgoraNum} onChange={() => aplicarDolar('agora', pz.cambio_spread_pct ?? '')}/>
                  (USD) PTAX Agora
                </label>
              </th>
              <th>Custo Fornecedor (USD)</th>
              <th style={{ background: 'var(--vp-yellow, #FBB039)', color: '#111' }} title="Custo do fornecedor em US$ × o dólar usado no cálculo (PTAX marcada + %). É este valor que o cálculo usa.">Custo Fornecedor (R$) — dólar do cálculo</th>
              <th>R$ no dia da cotação</th><th>R$ agora (ao vivo)</th>
            </tr></thead>
            <tbody>
              {(pz.modelos || []).length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--fg3)', fontSize: 13 }}>Nenhuma unidade encontrada.</td></tr>
              )}
              {(pz.modelos || []).map((m, i) => {
                const custoUsd = Number(m.valorUnitarioUsd) || 0;
                const ptaxCotacao = pz.cambio_na_cotacao_usd_brl;
                const ptaxAgora = cambioVivo && cambioVivo !== 'erro' ? cambioVivo.valor : null;
                // O % incide só sobre o dólar ESCOLHIDO; o outro fica como referência.
                const usaCot = cambioBase === 'cotacao' && cambioSpread > 0 && ptaxCotacao != null;
                const usaAgo = cambioBase === 'agora' && cambioSpread > 0 && ptaxAgora != null;
                const ptaxCotacaoUsada = usaCot ? ptaxCotacao * (1 + cambioSpread) : ptaxCotacao;
                const ptaxAgoraUsada = usaAgo ? ptaxAgora * (1 + cambioSpread) : ptaxAgora;

                return (
                  <tr key={m.unidadeId || i}>
                    <td>
                      {m.identificador}
                      {(() => {
                        // Códigos corridos 1..N gerados na explosão (ver renumerarPorParadas): mostra a faixa desta unidade.
                        const nums = (pz.mo_lookup || [])
                          .filter((x) => x.unidadeId && x.unidadeId === m.unidadeId && x.identificador)
                          .map((x) => { const r = /^(.*)-(\d+)$/.exec(x.identificador); return r ? { p: r[1], n: Number(r[2]) } : null; })
                          .filter(Boolean).sort((a, b) => a.n - b.n);
                        if (!nums.length) return null;
                        const a = nums[0], z = nums[nums.length - 1];
                        const txt = nums.length === 1 ? `equipamento ${a.p}-${a.n}` : `equipamentos ${a.p}-${a.n} a -${z.n} (${nums.length})`;
                        return <div className="small muted mono" style={{ fontSize: 11 }}>{txt}</div>;
                      })()}
                    </td>
                    <td><PZInput value={m.modelo} onChange={setModelo(i, 'modelo')}/></td>
                    <td><PZInput type="number" value={m.quantidade} onChange={setModelo(i, 'quantidade')}/></td>
                    <td className="mono muted">{cambioSpread > 0 ? `+${fmtPct2(cambioSpread)}` : '—'}</td>
                    <td className="mono muted" title="PTAX congelada no dia em que o fornecedor respondeu.">
                      {ptaxCotacao != null ? fmtBRL2(ptaxCotacao) : '—'}
                      {usaCot && <div style={{ color: 'var(--fg1)', fontWeight: 700 }}>→ {fmtBRL2(ptaxCotacaoUsada)}</div>}
                    </td>
                    <td className="mono muted" title="PTAX consultada agora, para referência ao vivo.">
                      {ptaxAgora != null ? fmtBRL2(ptaxAgora) : 'indisponível'}
                      {usaAgo && <div style={{ color: 'var(--fg1)', fontWeight: 700 }}>→ {fmtBRL2(ptaxAgoraUsada)}</div>}
                    </td>
                    <td><PZInput type="number" value={m.valorUnitarioUsd} onChange={setModelo(i, 'valorUnitarioUsd')}/></td>
                    <td className="mono" style={{ fontWeight: 700, background: 'rgba(251,176,57,.14)' }} title={dolarDoCalculo ? `US$ ${custoUsd} × ${fmtDolar(dolarDoCalculo)}` : 'informe o câmbio'}>
                      {dolarDoCalculo ? fmtBRL2(custoUsd * dolarDoCalculo) : '—'}
                    </td>
                    <td className="mono muted" title="PTAX do dia da cotação × custo em USD — referência; o cálculo oficial continua usando o Câmbio abaixo.">
                      {ptaxCotacao != null ? fmtBRL2(custoUsd * ptaxCotacaoUsada) : '—'}
                    </td>
                    <td className="mono muted" title="PTAX de agora × custo em USD — referência ao vivo; o cálculo oficial continua usando o Câmbio abaixo.">
                      {ptaxAgora != null ? fmtBRL2(custoUsd * ptaxAgoraUsada) : '—'}
                    </td>
                  </tr>
                );
              })}
              {(pz.modelos || []).length > 0 && (() => {
                const totUsd = (pz.modelos || []).reduce((acc, m) => acc + (Number(m.valorUnitarioUsd) || 0) * (Number(m.quantidade) || 0), 0);
                return (
                  <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                    <td colSpan={4} style={{ textAlign: 'right' }}>Total do fornecedor (VMLE)</td>
                    <td/><td/>
                    <td className="mono">{'US$ ' + totUsd.toFixed(2)}</td>
                    <td className="mono" style={{ background: 'rgba(251,176,57,.14)' }}>{dolarDoCalculo ? fmtBRL2(totUsd * dolarDoCalculo) : '—'}</td>
                    <td/><td/>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
        {precoDesatualizado && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#fffbeb', border: '1px solid #FBB039', fontSize: 13 }}>
            ⚠ O preço de venda ainda está calculado com o dólar antigo ({fmtDolar(cambioDoUltimoCalculo)}). Clique em <b>Calcular</b> para refazer tudo com {fmtDolar(Number(pz.tx_cambial))}.
          </div>
        )}
        <div className="pl-note" style={{ marginTop: 10 }}>
          <b>Dólar usado no cálculo:</b> {dolarAplicado == null
            ? <>{fmtDolar(Number(pz.tx_cambial) || null)} — digitado em "Câmbio (R$/US$)". Marque a PTAX do dia da cotação ou a de agora no cabeçalho (e, se quiser, informe um % sobre o dólar) para calcular a partir dela.</>
            : <>{fmtDolar(dolarAplicado)} = PTAX {cambioBase === 'cotacao' ? 'do dia da cotação' : 'de agora'} ({fmtDolar(ptaxBaseValor)}){cambioSpread > 0 ? ` + ${fmtPct2(cambioSpread)}` : ''}. Esse valor vai para o campo "Câmbio (R$/US$)" abaixo.</>}
        </div>
      </Card>

      <Card title="Mão de obra — busca automática" sub="tração × capacidade × paradas em Cadastros → Atualização de Custos"
        style={{ marginTop: 16 }}
        action={
          <div className="row gap-2">
            <Button variant="outline" size="sm" icon="plus" onClick={() => setMostrarAcrescentarEquipamento(true)} disabled={atualizandoMo}>Acrescentar equipamento</Button>
            <Button variant="outline" size="sm" icon="refresh" onClick={atualizarMaoDeObra} disabled={atualizandoMo}>{atualizandoMo ? 'Recalculando…' : 'Recalcular'}</Button>
          </div>
        }>
        {!(pz.mo_lookup || []).length && <p className="small muted" style={{ margin: 0 }}>Nenhuma unidade elevador com dados suficientes ainda.</p>}
        {!!(pz.mo_lookup || []).length && (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Unidade</th><th>Tração</th><th>Capacidade</th><th>Paradas</th><th>Situação</th><th>Regra usada</th><th>Valor (R$)</th><th></th></tr></thead>
              <tbody>
                {pz.mo_lookup.map((mo, i) => {
                  // Unidade com quantidade > 1 vira várias linhas (mesmo unidadeId,
                  // uma por equipamento físico — ver buscarMaoDeObraAutomatica).
                  // "Trocar" aparece em TODAS as linhas do grupo (tração/capacidade/
                  // paradas são da Unidade inteira, então editar de qualquer uma
                  // delas salva pra todo o grupo) — editandoMoUnidade guarda a
                  // `chave` (linha física exata clicada, não só o unidadeId
                  // compartilhado) pra abrir a edição só ali, nunca em todas as
                  // linhas do grupo ao mesmo tempo.
                  const chave = `${mo.unidadeId || 'x'}-${mo.equipamentoIndice || i}`;
                  const editando = editandoMoUnidade === chave;
                  if (editando) {
                    return (
                      <tr key={chave} style={{ background: 'var(--vp-gray-50)' }}>
                        <td>{mo.identificador || '—'}</td>
                        <td>
                          <select className="input" style={{ minWidth: 90 }} value={moSpecEdit.tracao}
                            onChange={(e) => setMoSpecEdit((s) => ({ ...s, tracao: e.target.value }))}>
                            <option value="">— selecione —</option>
                            {PZ_TRACOES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td>
                          <input className="input" type="number" style={{ width: 100 }} value={moSpecEdit.capacidadeKg}
                            onChange={(e) => setMoSpecEdit((s) => ({ ...s, capacidadeKg: e.target.value }))} placeholder="kg"/>
                        </td>
                        <td>
                          <input className="input" type="number" style={{ width: 70 }} value={moSpecEdit.paradas}
                            onChange={(e) => setMoSpecEdit((s) => ({ ...s, paradas: e.target.value }))}/>
                        </td>
                        <td colSpan={2} className="small muted">Muda aqui atualiza o Formulário de Elevadores desta unidade.</td>
                        <td/>
                        <td>
                          <div className="row gap-1">
                            <Button variant="primary" size="sm" icon="check" disabled={atualizandoMo} onClick={() => salvarSpecUnidade(mo.unidadeId)}>Salvar</Button>
                            <Button variant="ghost" size="sm" icon="x" onClick={() => setEditandoMoUnidade(null)}/>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={chave}>
                      <td>{mo.identificador || '—'}{mo.avulso && <span className="badge" style={{ background: 'var(--vp-gray-100)', color: 'var(--fg2)', padding: '2px 6px', borderRadius: 4, fontSize: 10, marginLeft: 6 }} title="Acrescentado nesta Precificação — não existe como Unidade no Formulário de Elevadores">manual</span>}</td>
                      <td>{mo.tracao || '—'}</td>
                      <td>{mo.capacidadeKg != null ? `${mo.capacidadeKg} kg` : '—'}{mo.passageiros ? <div className="cell-sub">{mo.passageiros} passageiros</div> : null}</td>
                      <td>{mo.paradas != null ? mo.paradas : '—'}</td>
                      <td>
                        {mo.situacao === 'confirmado' && !mo.estimativa && <span className="badge" style={{ background: 'var(--vp-success)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>Confirmado</span>}
                        {mo.estimativa && <span className="badge" style={{ background: '#fffbeb', color: '#b45309', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>Estimativa — não confirmada</span>}
                        {mo.projetoEspecial && <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>Projeto especial</span>}
                        {mo.situacao === 'pendente' && !mo.projetoEspecial && <span className="badge" style={{ background: '#fffbeb', color: '#b45309', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>Pendente</span>}
                        {mo.situacao === 'excluido' && <span className="badge" style={{ background: 'var(--vp-gray-200)', color: 'var(--fg2)', padding: '2px 8px', borderRadius: 4, fontSize: 11 }} title={mo.motivo || ''}>Fora do escopo VP</span>}
                      </td>
                      <td className="small muted" title={mo.motivo || ''}>{mo.regraUsada || mo.motivo || '—'}</td>
                      <td className="mono">{mo.valorRs ? fmtBRL2(mo.valorRs) : '—'}</td>
                      <td>
                        <div className="row gap-1">
                          {mo.unidadeId && !mo.avulso && (
                            <Button variant="ghost" size="sm" icon="edit" title={mo.equipamentoTotal > 1 ? `Trocar tração/capacidade/paradas desta unidade (vale para os ${mo.equipamentoTotal} equipamentos)` : 'Trocar tração/capacidade/paradas desta unidade'}
                              onClick={() => {
                                setMoSpecEdit({ tracao: mo.tracao || '', capacidadeKg: mo.capacidadeKg ?? '', paradas: mo.paradas ?? '' });
                                setEditandoMoUnidade(chave);
                              }}>
                              Trocar
                            </Button>
                          )}
                          {mo.unidadeId && mo.situacao !== 'excluido' && (
                            <Button variant="ghost" size="sm" icon="trash" title="Excluir a Mão de obra deste equipamento (instalação não é por conta da VerticalParts) — o equipamento continua na cotação"
                              onClick={() => setRemovendoEquipamento(mo)}>
                              Remover
                            </Button>
                          )}
                          {mo.unidadeId && mo.situacao === 'excluido' && (
                            <Button variant="ghost" size="sm" icon="refresh" disabled={atualizandoMo} title="Devolver este equipamento pro cálculo normal de Mão de obra"
                              onClick={() => devolverEquipamentoMO(mo.unidadeId)}>
                              Devolver ao cálculo
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {(pz.mo_lookup || []).some((mo) => mo.projetoEspecial) && (
          <p style={{ fontSize: 12, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '8px 12px', marginTop: 12, borderRadius: 6 }}>
            ⚠ Uma ou mais unidades caíram fora da cobertura da tabela de MO — trate como projeto especial (estimativa não confirmada, exige justificativa e aprovação técnica/financeira antes de aprovar a precificação). O valor não entra sozinho na conta — adicione manualmente em "Instalação e Montagem" abaixo quando tiver uma cotação de instalador/engenharia.
          </p>
        )}
        {(pz.mo_lookup || []).some((mo) => mo.estimativa) && (
          <p style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '8px 12px', marginTop: 12, borderRadius: 6 }}>
            ⚠ Uma ou mais unidades usam valor de MO <b>estimado por extrapolação estatística</b> (Cadastros → Atualização de Custos), não uma cotação real de instalador — exige a mesma aprovação técnica/financeira de um projeto especial antes de aprovar a precificação.
          </p>
        )}
      </Card>

      <Card title="Despesas de importação" style={{ marginTop: 16 }}>
        <div className="grid-3" style={{ gap: 12 }}>
          <PZField label="VMLE (USD)" obrigatorio faltando={f('vmle_usd')}><PZCurrencyInput moeda="USD" value={pz.vmle_usd} onChange={set('vmle_usd')}/></PZField>
          <PZField label="Seguro (USD)"><PZCurrencyInput moeda="USD" value={pz.seguro_usd} onChange={set('seguro_usd')}/></PZField>
          {/* 01/10/2026 — container e capatazia vêm do cadastro (Despesa Operacional); este
              campo só aparece quando já há um frete internacional lançado (informado pelo
              fornecedor na cotação, ou precificação antiga) pra poder ser conferido/zerado. */}
          {Number(pz.frete_seguro_capatazia_usd) > 0 && (
            <PZField label="Frete internacional informado (USD)">
              <PZCurrencyInput moeda="USD" value={pz.frete_seguro_capatazia_usd} onChange={set('frete_seguro_capatazia_usd')}/>
              <div className="small muted" style={{ marginTop: 4 }}>Container e capatazia vêm do cadastro de Containers — não some aqui de novo. Zere se este valor já os incluía.</div>
            </PZField>
          )}
          <PZField label="Siscomex (R$)"><PZCurrencyInput moeda="BRL" value={pz.siscomex_rs} onChange={set('siscomex_rs')}/></PZField>
          <PZField label="Câmbio (R$/US$)" obrigatorio faltando={f('tx_cambial')}>
            <PZInput type="number" value={pz.tx_cambial} onChange={set('tx_cambial')}/>
            {cambioForaFaixa && <div style={{ color: '#991b1b', fontSize: 11, marginTop: 4 }}>Fora da faixa {CAMBIO_MIN}–{CAMBIO_MAX}. Confira se não digitou aqui um valor de taxa/frete.</div>}
            {cambioVivo && cambioVivo !== 'erro' && (
              <div className="row gap-2" style={{ marginTop: 4, alignItems: 'center' }}>
                <span className="mono small muted">Dólar agora: {fmtBRL2(cambioVivo.valor)}</span>
                <Button variant="ghost" size="sm" onClick={() => set('tx_cambial')(cambioVivo.valor)}>Usar</Button>
              </div>
            )}
            {cambioVivo === 'erro' && <div className="muted small" style={{ marginTop: 4 }}>Câmbio ao vivo indisponível agora.</div>}
          </PZField>
          <PZField label="Outras despesas (R$)"><PZCurrencyInput moeda="BRL" value={pz.outras_despesas_importacao_rs} onChange={set('outras_despesas_importacao_rs')}/></PZField>
          <PZField label="Despachante + Desembaraço (R$)"><PZCurrencyInput moeda="BRL" value={pz.despachante_desembaraco_rs} onChange={set('despachante_desembaraco_rs')}/></PZField>
          <PZField label="Demurrage (R$)"><PZCurrencyInput moeda="BRL" value={pz.demurrage_rs} onChange={set('demurrage_rs')}/></PZField>
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>
            Containers <span style={{ opacity: .6, fontWeight: 400, textTransform: 'none' }}>— tipo/quantidade vêm da resposta do fornecedor; preço e capatazia herdados do cadastro de Containers (Atualização de Custos) — Despesa Operacional</span>
          </div>
          {divergenciasContainer.length > 0 && (
            <div style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '8px 12px', marginBottom: 8, borderRadius: 6 }}>
              ⚠ Difere do cadastro de Containers: {divergenciasContainer.map((d) => `${d.rotulo} da linha ${d.indice + 1} (${fmtBRL2(d.atual)} × cadastro ${fmtBRL2(d.cadastro)})`).join('; ')}. Pode ser edição intencional.
            </div>
          )}
          <div className="stack" style={{ gap: 8 }}>
            {(pz.containers || []).length > 0 && (
              <div className="row gap-2 up-eyebrow muted" style={{ fontSize: 11 }}>
                <div style={{ width: 140 }}>Tipo</div>
                <div style={{ width: 100 }}>Qtd</div>
                <div style={{ width: 160 }}>Preço do container (R$)</div>
                <div style={{ width: 160 }}>Capatazia (R$)</div>
                <div style={{ width: 160 }}>GRI (R$)</div>
              </div>
            )}
            {(pz.containers || []).map((ct, i) => (
              <div key={i} className="row gap-2">
                <div style={{ width: 140 }}><PZSelect value={ct.tipo_tamanho} onChange={setContainer(i, 'tipo_tamanho')} options={PZ_CONTAINER_TIPOS} placeholder="Tamanho"/></div>
                <input className="input" style={{ width: 100 }} type="number" value={ct.quantidade ?? 1} onChange={(e) => setContainer(i, 'quantidade')(Number(e.target.value) || 0)} placeholder="Qtd"/>
                <div style={{ width: 160 }}><PZCurrencyInput moeda="BRL" value={ct.preco_rs} onChange={setContainer(i, 'preco_rs')}/></div>
                <div style={{ width: 160 }}><PZCurrencyInput moeda="BRL" value={ct.capatazia_rs} onChange={setContainer(i, 'capatazia_rs')}/></div>
                <div style={{ width: 160 }}><PZCurrencyInput moeda="BRL" value={ct.gri_rs} onChange={setContainer(i, 'gri_rs')}/></div>
                <Button variant="ghost" size="sm" icon="trash" onClick={() => removeContainer(i)}/>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" icon="plus" style={{ marginTop: 8 }} onClick={addContainer}>+ Adicionar container</Button>
          {(pz.containers || []).length > 0 && <div className="small muted" style={{ marginTop: 8 }}>Subtotal Containers: <b>{fmtBRL2(containersTotalRs)}</b> · Capatazia: <b>{fmtBRL2(capataziaTotalRs)}</b> · GRI: <b>{fmtBRL2(griTotalRs)}</b></div>}
        </div>
      </Card>

      <Card title="Despesas Operacionais" sub="custos itemizados — instalação/montagem e o que mais entrar aqui no futuro" style={{ marginTop: 16 }}>
        <div>
          <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>
            Instalação e Montagem <span style={{ opacity: .6, fontWeight: 400, textTransform: 'none' }}>— lista fixa; Mão de obra herda a soma da tabela acima, o resto é preenchimento avulso de Engenharia/Logística</span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {(pz.itens_instalacao_montagem || []).map((it, i) => (
              <div key={it.descricao || i} className="row gap-2" style={{ alignItems: 'center' }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{it.descricao}</div>
                {i === 0 ? (
                  <div style={{ width: 160, textAlign: 'right' }} className="mono" title="Soma automática da tabela de Mão de obra acima — Confirmado + Estimativa">
                    {fmtBRL2(it.valor)}
                  </div>
                ) : (
                  <div style={{ width: 160 }}><PZCurrencyInput moeda="BRL" value={it.valor} onChange={setItemInstalacao(i, 'valor')}/></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Despesas Extras" sub="catch-all — recorrentes ou planejadas que ainda não têm seção própria" style={{ marginTop: 16 }}>
        <div className="grid-3" style={{ gap: 12 }}>
          <PZField label="Frete interno (R$)"><PZCurrencyInput moeda="BRL" value={pz.frete_interno_rs} onChange={set('frete_interno_rs')}/></PZField>
          <PZField label="Armazenagem (R$)"><PZCurrencyInput moeda="BRL" value={pz.armazenagem_rs} onChange={set('armazenagem_rs')}/></PZField>
          <PZField label="% de Serviços"><PZPercentInput value={pz.percentual_servicos} onChange={set('percentual_servicos')}/></PZField>
          <PZField label="Contingência (R$)"><PZCurrencyInput moeda="BRL" value={pz.contingencia_valor} onChange={set('contingencia_valor')}/></PZField>
          <PZField label="Outros custos não recuperáveis (R$)"><PZCurrencyInput moeda="BRL" value={pz.outros_custos_nao_recuperaveis_rs} onChange={set('outros_custos_nao_recuperaveis_rs')}/></PZField>
        </div>
        <PZFreteSugestao pz={pz} onUsar={set('frete_interno_rs')}/>
        <p className="small muted" style={{ marginTop: 8 }}>Contingência e outros custos não recuperáveis não entram no preço de venda: só abatem do lucro (como na planilha do Financeiro).</p>

        <div style={{ marginTop: 20 }}>
          <div className="up-eyebrow muted" style={{ marginBottom: 8 }}>
            Itens avulsos <span style={{ opacity: .6, fontWeight: 400, textTransform: 'none' }}>— despesas recorrentes ou planejadas sem campo próprio ainda</span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {(pz.itens_despesas_extras || []).map((it, i) => (
              <div key={i} className="row gap-2">
                <input className="input" style={{ flex: 1 }} value={it.descricao || ''} onChange={(e) => setItemExtra(i, 'descricao')(e.target.value)} placeholder="ex.: Seguro adicional, taxa bancária..."/>
                <div style={{ width: 160 }}><PZCurrencyInput moeda="BRL" value={it.valor} onChange={setItemExtra(i, 'valor')}/></div>
                <Button variant="ghost" size="sm" icon="trash" onClick={() => removeItemExtra(i)}/>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" icon="plus" style={{ marginTop: 8 }} onClick={addItemExtra}>+ Adicionar item</Button>
        </div>
      </Card>

      {(() => {
        /* 31/08 — pedido do usuário: resumo consolidado por categoria.
           Cada linha soma direto dos campos que já existem nas seções
           acima — nada novo é digitado aqui, é só reagrupamento visual.
           "Custos Imposto" é a única que depende do motor fiscal completo
           (cascata II/IPI/PIS/COFINS/ICMS, precisa de "Calcular" já ter
           rodado pelo menos uma vez) — antes disso mostra "—", nunca zero
           fingindo que não há imposto. */
        const txCambial = Number(pz.tx_cambial) || 0;
        const custosEquipamentosRs = (Number(pz.vmle_usd) || 0) * txCambial;
        const custosFreteRs = ((Number(pz.seguro_usd) || 0) + (Number(pz.frete_seguro_capatazia_usd) || 0)) * txCambial;
        const itensInst = pz.itens_instalacao_montagem || [];
        const moRs = Number(itensInst[0] ? itensInst[0].valor : 0) || 0;
        const custosOperacionaisRs = itensInst.slice(1).reduce((s, it) => s + (Number(it.valor) || 0), 0);
        const freteInternoRs = Number(pz.frete_interno_rs) || 0;
        /* 15/09 — achado real (auditoria do tour.md): a soma abaixo cobria só
           6 das ~15 linhas que o usuário efetivamente preenche nas seções
           acima (faltavam Siscomex, Despachante+Desembaraço, Demurrage,
           Outras despesas, Armazenagem, Containers, Despesas Extras avulsas,
           Contingência e Outros custos não recuperáveis) — o rótulo "Soma"
           só avisava da ausência do Imposto, nunca dessas 9 outras lacunas,
           passando falsa impressão de custo total. Completando a soma com
           todos os campos que já existem nas seções acima. */
        const despesasImportacaoRs = (Number(pz.siscomex_rs) || 0) + (Number(pz.despachante_desembaraco_rs) || 0)
          + (Number(pz.demurrage_rs) || 0) + (Number(pz.outras_despesas_importacao_rs) || 0);
        const armazenagemRs = Number(pz.armazenagem_rs) || 0;
        const despesasExtrasRs = (pz.itens_despesas_extras || []).reduce((s, it) => s + (Number(it.valor) || 0), 0);
        const contingenciaOutrosRs = (Number(pz.contingencia_valor) || 0) + (Number(pz.outros_custos_nao_recuperaveis_rs) || 0);
        const impImportacao = (pz.resultado_v2 || pz.resultado || {}).importacao;
        const custosImpostoRs = impImportacao
          ? (Number(impImportacao.ii) || 0) + (Number(impImportacao.ipi) || 0) + (Number(impImportacao.pis) || 0)
            + (Number(impImportacao.cofins) || 0) + (Number(impImportacao.icms) || 0)
          : null;
        const somaRs = custosEquipamentosRs + custosFreteRs + moRs + custosOperacionaisRs + freteInternoRs
          + despesasImportacaoRs + armazenagemRs + containersTotalRs + capataziaTotalRs + griTotalRs + despesasExtrasRs + contingenciaOutrosRs
          + (custosImpostoRs || 0);
        const linha = (label, valor) => (
          <div className="row sb" style={{ padding: '4px 0' }}>
            <span className="small">{label}</span>
            <span className="mono">{valor == null ? '—' : fmtBRL2(valor)}</span>
          </div>
        );
        return (
          <Card title="Resumo de Custos" sub="visão consolidada — cada linha soma os campos já preenchidos nas seções acima" style={{ marginTop: 16 }}>
            <div className="stack" style={{ gap: 2 }}>
              {linha('Custos Equipamentos', custosEquipamentosRs)}
              {linha('Custos com Frete', custosFreteRs)}
              {linha('Mão de Obra', moRs)}
              {linha('Custos Operacionais (Empilhadeira, Munck...)', custosOperacionaisRs)}
              {linha('Frete Interno (no Brasil)', freteInternoRs)}
              {linha('Despesas de Importação (Siscomex, Despachante, Demurrage, Outras)', despesasImportacaoRs)}
              {linha('Armazenagem', armazenagemRs)}
              {linha('Containers', containersTotalRs)}
              {linha('Capatazia', capataziaTotalRs)}
              {linha('GRI', griTotalRs)}
              {linha('Despesas Extras (itens avulsos)', despesasExtrasRs)}
              {linha('Contingência e Outros custos não recuperáveis', contingenciaOutrosRs)}
              {linha('Custos Imposto', custosImpostoRs)}
              <div className="row sb" style={{ borderTop: '2px solid var(--border)', paddingTop: 10, marginTop: 6 }}>
                <span style={{ fontWeight: 700 }}>Soma{custosImpostoRs == null ? ' (parcial — falta Custos Imposto)' : ''}</span>
                <span className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{fmtBRL2(somaRs)}</span>
              </div>
            </div>
            {custosImpostoRs == null && (
              <p className="small muted" style={{ marginTop: 8 }}>Custos Imposto aparece depois de clicar em "Calcular" — usa a cascata fiscal completa (II/IPI/PIS/COFINS/ICMS).</p>
            )}
          </Card>
        );
      })()}

      <Card title="Alavancas do Financeiro" style={{ marginTop: 16 }}>
        <div className="grid-3" style={{ gap: 12 }}>
          <PZField label={mostrarExpresso ? 'MARK-UP (% do preço) — 120 dias' : 'MARK-UP (% do preço de venda)'} obrigatorio faltando={f('mark_up_pct')}>
            <PZPercentInput value={pz.mark_up_pct} onChange={set('mark_up_pct')}/>
            {markUpForaFaixa && <div style={{ color: '#991b1b', fontSize: 11, marginTop: 4 }}>Markup de {fmtPct2(pz.mark_up_pct)} parece implausível — confira o valor (o mark-up é % do preço de venda e precisa ficar abaixo de 100% menos os impostos).</div>}
          </PZField>
          {mostrarExpresso && (
            <PZField label="MARK-UP (% do preço) — 90 dias">
              <PZPercentInput value={pz.mark_up_pct_expresso ?? pz.mark_up_pct} onChange={set('mark_up_pct_expresso')}/>
              <div className="small muted" style={{ marginTop: 4 }}>Só vale pro card de 90 dias (exclusivo).</div>
            </PZField>
          )}
          <PZField label="Comissão consultoria (%) — 0 a 5%" obrigatorio faltando={f('comissao_consultoria_pct')} aviso="Obrigatório: digite de 0% a 5% (0 vale)." ><PZPercentInput value={pz.comissao_consultoria_pct} onChange={set('comissao_consultoria_pct')}/></PZField>
          <PZField label="Comissão vendedor (%)" obrigatorio faltando={f('comissao_vendedor_pct')}><PZPercentInput value={pz.comissao_vendedor_pct} onChange={set('comissao_vendedor_pct')}/></PZField>
          <PZField label="Comissão indicação (%)"><PZPercentInput value={pz.comissao_indicacao_pct} onChange={set('comissao_indicacao_pct')}/></PZField>
          <PZField label="Margem mínima (%)"><PZPercentInput value={params.margem_minima_pct} onChange={setParam('margem_minima_pct')}/></PZField>
        </div>

        <Button variant="ghost" size="sm" style={{ marginTop: 12 }} onClick={() => setMostrarParametros((v) => !v)}>
          {mostrarParametros ? 'Ocultar' : 'Ver/editar'} parâmetros fiscais (regime, impostos)
        </Button>
        {mostrarParametros && (
          <div className="grid-3" style={{ gap: 12, marginTop: 12 }}>
            <PZField label="Regime tributário"><PZInput value={params.regime_tributario} onChange={setParam('regime_tributario')}/></PZField>
            <PZField label="ICMS importação (%)"><PZPercentInput value={params.icms_importacao_pct} onChange={setParam('icms_importacao_pct')}/></PZField>
            <PZField label="IPI importação (%)"><PZPercentInput value={params.ipi_importacao_pct} onChange={setParam('ipi_importacao_pct')}/></PZField>
            <PZField label="PIS importação (%)"><PZPercentInput value={params.pis_importacao_pct} onChange={setParam('pis_importacao_pct')}/></PZField>
            <PZField label="COFINS importação (%)"><PZPercentInput value={params.cofins_importacao_pct} onChange={setParam('cofins_importacao_pct')}/></PZField>
            <PZField label="II importação (%)"><PZPercentInput value={params.ii_importacao_pct} onChange={setParam('ii_importacao_pct')}/></PZField>
            <PZField label="ICMS venda (%)"><PZPercentInput value={params.icms_venda_pct} onChange={setParam('icms_venda_pct')}/></PZField>
            <PZField label="PIS venda (%)"><PZPercentInput value={params.pis_venda_pct} onChange={setParam('pis_venda_pct')}/></PZField>
            <PZField label="COFINS venda (%)"><PZPercentInput value={params.cofins_venda_pct} onChange={setParam('cofins_venda_pct')}/></PZField>
            <PZField label="IRPJ venda (%)"><PZPercentInput value={params.irpj_venda_pct} onChange={setParam('irpj_venda_pct')}/></PZField>
            <PZField label="CSLL venda (%)"><PZPercentInput value={params.csll_venda_pct} onChange={setParam('csll_venda_pct')}/></PZField>
            <PZField label="Impostos a pagar — serviços (%)"><PZPercentInput value={params.impostos_pagar_servicos_pct} onChange={setParam('impostos_pagar_servicos_pct')}/></PZField>
            <p className="small muted" style={{ gridColumn: 'span 3', margin: 0 }}>
              Esses % são regulatórios (lei federal/estadual) e mudam com o tempo — editar aqui afeta só esta precificação. Para mudar o padrão do sistema, atualize em Parâmetros Fiscais.
            </p>
          </div>
        )}
      </Card>

      {difal && (
        <Card title="DIFAL" style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, margin: 0 }}>{difal.mensagem}</p>
          {difal.alerta && (
            <p style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #FBB039', padding: '8px 12px', marginTop: 10 }}>{difal.alerta}</p>
          )}
        </Card>
      )}

      <Card title="Formação do Preço" sub="método da planilha do Financeiro" style={{ marginTop: 16 }}>
        <div className="pl-note">
          <b>Preço = custo da nota (já sem os créditos) ÷ (1 − impostos da venda − MARK-UP).</b> O MARK-UP é uma margem sobre o
          <b> preço de venda</b> (ex.: 53% na cotação 963). O frete internacional, o container, a capatazia e a GRI entram no valor CIF
          e pagam II, PIS, COFINS, ICMS e AFRMM. Despachante, ad-valorem, frete interno, armazenagem e instalação só abatem do <b>lucro</b>, depois do preço.
          Contingência e outros custos não recuperáveis vêm do card "Despesas Extras". Veja o passo a passo na "Memória de cálculo" abaixo.
        </div>
        {!resultadoV2 && <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>Clique em "Calcular" pra ver o preço de venda.</p>}
      </Card>

      {resultadoV2 && (
        <div className={mostrarExpresso ? 'grid-2' : ''} style={{ gap: 16, marginTop: 16 }}>
          <Card title={mostrarExpresso ? 'Preço de venda — 120 dias (Compartilhado)' : 'Preço de venda'} sub={mostrarExpresso ? 'container compartilhado, prazo padrão' : undefined}>
            <div className="stack" style={{ gap: 12 }}>
              <div><span className="up-eyebrow muted">Custo econômico completo</span><div className="cell-money" style={{ fontSize: 15 }}>{fmtBRL2(resultadoV2.custoEconomicoCompleto)}</div></div>
              <PZPrecoPorEquipamento modelos={pz.modelos} moLookup={pz.mo_lookup} precoTotal={resultadoV2.precificacao.precoVendaProposta}
                  ceo={pz.valores_sugeridos_ceo || {}} res={resultadoV2}
                  onCeo={(patch) => setPz((p) => { const novo = { ...(p.valores_sugeridos_ceo || {}) }; Object.keys(patch).forEach((k) => { if (patch[k] == null) delete novo[k]; else novo[k] = patch[k]; }); return { ...p, valores_sugeridos_ceo: novo }; })}
                  onAplicar={(campo, valor) => { set(campo)(valor); window.toast?.('Alavanca ajustada — clique em Calcular para refazer o preço.', 'info'); }}/>
              <div><span className="up-eyebrow muted">{quantidadeEquipamentos > 1 ? 'Total da cotação — soma dos equipamentos acima' : 'Preço de venda total'}</span><div className="cell-money" style={{ fontSize: 20, fontWeight: 800 }}>{fmtBRL2(resultadoV2.precificacao.precoVendaProposta)}</div></div>
              <div className="row gap-3">
                <div>
                  <span className="up-eyebrow muted">Margem efetiva</span>
                  <div className="cell-money" style={{ fontSize: 16, color: margemAbaixoMinima ? 'var(--vp-warning-ink)' : 'var(--vp-success)' }}>{fmtPct2(resultadoV2.precificacao.margemEfetivaPct)}</div>
                  {margemMinima > 0 && <div className="small muted" style={{ marginTop: 2 }}>mínima {fmtPct2(margemMinima)}</div>}
                </div>
                <div><span className="up-eyebrow muted">Lucro final</span><div className="cell-money" style={{ fontSize: 16, color: resultadoV2.precificacao.lucroFinal >= 0 ? 'var(--vp-success)' : 'var(--vp-warning-ink)' }}>{fmtBRL2(resultadoV2.precificacao.lucroFinal)}</div></div>
              </div>
            </div>
            {!resultadoV2.divisorValido && (
              <p style={{ fontSize: 12, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '8px 12px', marginTop: 12, borderRadius: 6 }}>
                ⚠ Divisor inválido (markup/margem + impostos + comissões somam 100% ou mais) — não é possível formar preço nesse cenário. Reduza o markup/margem desejada ou os percentuais de venda.
              </p>
            )}
            {resultadoV2.divisorValido && margemEfetivaV2Negativa && (
              <p style={{ fontSize: 12, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '8px 12px', marginTop: 12, borderRadius: 6 }}>
                ⚠ Margem efetiva negativa — este cenário não deveria ser aprovado como está. Revise custos operacionais, markup/margem ou comissões.
              </p>
            )}
            {resultadoV2.divisorValido && !margemEfetivaV2Negativa && margemAbaixoMinima && (
              <p style={{ fontSize: 12, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '8px 12px', marginTop: 12, borderRadius: 6 }}>
                ⚠ Margem efetiva ({fmtPct2(resultadoV2.precificacao.margemEfetivaPct)}) abaixo da mínima configurada ({fmtPct2(margemMinima)}). É possível aprovar mesmo assim, com confirmação.
              </p>
            )}
          </Card>

          {mostrarExpresso && (
            <Card title="Preço de venda — 90 dias (Exclusivo)" sub="container exclusivo, entrega mais rápida">
              <div className="stack" style={{ gap: 12 }}>
                <div><span className="up-eyebrow muted">Custo econômico completo</span><div className="cell-money" style={{ fontSize: 15 }}>{fmtBRL2(resultadoV2Expresso.custoEconomicoCompleto)}</div></div>
                <PZPrecoPorEquipamento modelos={pz.modelos} moLookup={pz.mo_lookup} precoTotal={resultadoV2Expresso.precificacao.precoVendaProposta}/>
                <div><span className="up-eyebrow muted">Preço de venda total</span><div className="cell-money" style={{ fontSize: 20, fontWeight: 800 }}>{fmtBRL2(resultadoV2Expresso.precificacao.precoVendaProposta)}</div></div>
                <div className="row gap-3">
                  <div>
                    <span className="up-eyebrow muted">Margem efetiva</span>
                    <div className="cell-money" style={{ fontSize: 16, color: resultadoV2Expresso.precificacao.margemEfetivaPct < margemMinima ? 'var(--vp-warning-ink)' : 'var(--vp-success)' }}>{fmtPct2(resultadoV2Expresso.precificacao.margemEfetivaPct)}</div>
                  </div>
                  <div><span className="up-eyebrow muted">Lucro final</span><div className="cell-money" style={{ fontSize: 16, color: resultadoV2Expresso.precificacao.lucroFinal >= 0 ? 'var(--vp-success)' : 'var(--vp-warning-ink)' }}>{fmtBRL2(resultadoV2Expresso.precificacao.lucroFinal)}</div></div>
                </div>
                <div className="small muted">{fmtBRL2(resultadoV2Expresso.precificacao.precoVendaProposta - resultadoV2.precificacao.precoVendaProposta)} a mais que os 120 dias</div>
              </div>
              {resultadoV2Expresso.precificacao.margemEfetivaPct < 0 && (
                <p style={{ fontSize: 12, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '8px 12px', marginTop: 12, borderRadius: 6 }}>
                  ⚠ Margem efetiva negativa no cenário de 90 dias — o container inteiro recai sobre um equipamento só; confira se o preço faz sentido antes de oferecer ao cliente.
                </p>
              )}
            </Card>
          )}
        </div>
      )}

      {window.PZMemoriaCalculo && Number(pz.vmle_usd) > 0 && (
        <window.PZMemoriaCalculo pz={pz}/>
      )}

      {mostrarAcrescentarEquipamento && (
        <ModalAcrescentarEquipamento
          grupos={pz.modelos || []}
          onClose={() => setMostrarAcrescentarEquipamento(false)}
          onConfirmar={acrescentarEquipamento}
        />
      )}
      {removendoEquipamento && (
        <ModalRemoverEquipamento
          mo={removendoEquipamento}
          onClose={() => setRemovendoEquipamento(null)}
          onConfirmar={() => removerEquipamento(removendoEquipamento.unidadeId)}
        />
      )}
    </div>
  );
}

Object.assign(window, { PrecificacaoElevadorPage });
