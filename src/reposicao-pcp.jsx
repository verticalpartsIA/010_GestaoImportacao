/* ============================================================
   reposicao-pcp.jsx — Logística Interna · Almoxarifado · aba "Reposição".
   Quanto comprar e QUANDO, a partir do CONSUMO MÉDIO REAL (saídas do estoque do Omie desde 01/01/2024) e do PRAZO DE
   CHEGADA — não do estoque mínimo (ver reposicao-calc.js). A maior parte é importada (~90 dias): comprar só quando encosta
   no mínimo é comprar tarde; por isso a tela mostra cobertura em dias e o ponto de pedido.
   Regras que existem por motivo real:
   - Dados vêm de cache no Supabase (pcp_consumo_mov / pcp_posicao_compra), abastecido pela função sync-pcp-consumo
     (cron diário 04:30/04:50 + botão "Atualizar"). O navegador nunca fala com o Omie.
   - Parâmetros (prazo importado/nacional, folga, ciclo, origens fora do consumo) em pcp_reposicao_config; só quem tem a
     alçada almoxarifado.reposicao_config altera (administrador sempre passa).
   - Custo/valor só para quem tem almoxarifado.ver_custo (sem ela nem é pedido ao banco).
   - "Fechar o container": a tela soma a cubagem (m³) do que está marcado e compara com a capacidade de referência do 40'HC.
     Item sem dimensão cadastrada fica de fora da soma e é contado no aviso.
   Nada é escrito no Omie aqui.
   ============================================================ */

const REP_STATUS = {
  critico: { label: 'Crítico', variant: 'danger', ordem: 0 },
  comprar: { label: 'Comprar', variant: 'warning', ordem: 1 },
  ok: { label: 'OK', variant: 'success', ordem: 2 },
  excesso: { label: 'Excesso', variant: 'info', ordem: 3 },
  sem_giro: { label: 'Sem giro', variant: 'neutral', ordem: 4 },
  sem_historico: { label: 'Sem histórico', variant: 'neutral', ordem: 5 },
  nao_repor: { label: 'Não repor', variant: 'neutral', ordem: 6 },
};
const REP_DEFASADO_H = 48;       // consumo/posição sem atualizar há mais que isso = aviso na tela

// Data de hoje no fuso de Brasília (toISOString é UTC: depois das 21h já viraria o dia seguinte).
const repHojeBrasilia = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const repDataHora = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso); if (isNaN(d)) return '—';
  const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return p.replace(',', '');
};
const repMesBR = (k) => k ? `${k.slice(5, 7)}/${k.slice(0, 4)}` : '—';
const repCsv = (rows) => '﻿' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';')).join('\r\n');
const repBaixar = (nome, texto) => {
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
const REP_M3_40HC = 76;          // capacidade nominal de referência do 40'HC (m³)

const repFmt = (v, d = 0) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: d });
const repMoeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const repData = (iso) => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '—';

function repValorOrd(l, col) {
  switch (col) {
    case 'item': return l.codigo;
    case 'situacao': return REP_STATUS[l.status].ordem;
    case 'consumo': return l.mediaMensal || 0;
    case 'prazo': return l.prazo || 0;
    case 'disp': return l.disponivel || 0;
    case 'caminho': return l.aCaminho || 0;
    case 'cobertura': return l.coberturaProj ?? 1e9;
    case 'pedido': return l.pedido ?? -1;
    case 'maximo': return l.maximo ?? -1;
    case 'sugestao': return l.sugestao || 0;
    case 'valor': return (l.sugestao || 0) * (l.custo > 0 ? l.custo : 0);
    case 'm3': return (l.sugestao || 0) * (l.m3un || 0);
    default: return 0;
  }
}

// Gráfico de barras do consumo mensal (últimos 24 meses completos), com a média de 12 meses marcada.
function RepGraficoConsumo({ l }) {
  const serie = (l.serie || []).slice(-24);
  if (!serie.length) return <div style={{ fontSize: 12, color: 'var(--fg3)' }}>Sem saídas registradas para este item.</div>;
  const max = Math.max(...serie, l.mediaMensal || 0, 1);
  const [a, m] = l.serieInicio.split('-').map(Number);
  const ini = a * 12 + (m - 1) + (l.serie.length - serie.length);
  const rot = (i) => { const t = ini + i; return `${String((t % 12) + 1).padStart(2, '0')}/${String(Math.floor(t / 12)).slice(2)}`; };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90, position: 'relative', borderBottom: '1px solid var(--border)' }}>
        {l.mediaMensal > 0 && <div title={`Média dos últimos 12 meses: ${repFmt(l.mediaMensal, 1)}`} style={{ position: 'absolute', left: 0, right: 0, bottom: `${(l.mediaMensal / max) * 100}%`, borderTop: '1px dashed var(--vp-yellow)' }}/>}
        {serie.map((v, i) => <div key={i} title={`${rot(i)}: ${repFmt(v, 1)}`} style={{ flex: 1, minWidth: 6, height: `${Math.max(v > 0 ? 3 : 0, (v / max) * 100)}%`, background: 'var(--vp-info)', opacity: v > 0 ? 1 : 0.25, borderRadius: '2px 2px 0 0' }}/>)}
      </div>
      <div style={{ display: 'flex', gap: 3, fontSize: 9, color: 'var(--fg3)' }}>
        {serie.map((_, i) => <div key={i} style={{ flex: 1, minWidth: 6, textAlign: 'center', overflow: 'hidden' }}>{i % 3 === 0 ? rot(i) : ''}</div>)}
      </div>
    </div>
  );
}

async function repLerTudo(montar) {
  const out = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await montar().range(de, de + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function AlmoxarifadoReposicao() {
  const sb = window.__VP_SB && window.__VP_SB.sb;
  const [perm, setPerm] = React.useState({ custo: false, config: false });
  const [cfg, setCfg] = React.useState(null);
  const [d, setD] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [atualizando, setAtualizando] = React.useState(null);     // texto de progresso
  const [statusF, setStatusF] = React.useState('acao');           // acao | todos | <status>
  const [grupo, setGrupo] = React.useState('comprados');          // comprados | fabricados | todos
  const [busca, setBusca] = React.useState('');
  const [sel, setSel] = React.useState(() => new Set());
  const [cfgAberta, setCfgAberta] = React.useState(false);
  const [edit, setEdit] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);
  const [comprando, setComprando] = React.useState(null);          // itens do modal "Enviar compra ao Omie" (compra-pcp.jsx)
  const [reqs, recarregarReqs] = window.usePcpRequisicoesRecentes();
  const [ordem, setOrdem] = React.useState(null);                    // { col, dir } — clique no cabeçalho; null = ordem padrão (situação → cobertura)
  const [aberto, setAberto] = React.useState(null);                  // código do item com o detalhe (gráfico mensal) aberto

  React.useEffect(() => {
    const T = window.PropostaStore;
    Promise.resolve(T?.temCapacidade?.('almoxarifado', 'ver_custo')).then(v => setPerm(p => ({ ...p, custo: !!v }))).catch(() => {});
    Promise.resolve(T?.temCapacidade?.('almoxarifado', 'reposicao_config')).then(v => setPerm(p => ({ ...p, config: !!v }))).catch(() => {});
  }, []);

  const carregar = React.useCallback(async () => {
    if (!sb) { setErro('Supabase não carregou.'); return; }
    try {
      const campos = 'codigo, descricao, unidade, familia, tipo_sped, altura_cm, largura_cm, profundidade_cm, nao_repor, nao_repor_motivo' + (perm.custo ? ', preco_custo, custo_manual, custo_compra' : '');
      const [c, cur, prods, estoque, pos, movs, estr, ultMov] = await Promise.all([
        sb.from('pcp_reposicao_config').select('*').eq('id', true).maybeSingle(),
        sb.from('pcp_consumo_cursor').select('concluido_ate, atualizado_em, proxima_data').eq('id', true).maybeSingle(),
        repLerTudo(() => sb.from('pcp_produtos').select(campos).eq('ativo', true).order('codigo')),
        repLerTudo(() => sb.from('pcp_estoque').select('codigo, quantidade').order('codigo')),
        repLerTudo(() => sb.from('pcp_posicao_compra').select('codigo, disponivel, pendente, atualizado_em').order('codigo')),
        repLerTudo(() => sb.from('pcp_consumo_mov').select('codigo, dt_mov, qtde, cod_origem').order('id_mov')),
        repLerTudo(() => sb.from('pcp_estrutura').select('codigo_pai').order('codigo_pai')),
        sb.from('pcp_consumo_mov').select('atualizado_em').order('atualizado_em', { ascending: false }).limit(1),
      ]);
      if (c.error) throw c.error;
      let ultimaPosicao = null; pos.forEach(p => { if (p.atualizado_em && (!ultimaPosicao || p.atualizado_em > ultimaPosicao)) ultimaPosicao = p.atualizado_em; });
      let ultimoMovimento = null; movs.forEach(m => { if (!ultimoMovimento || m.dt_mov > ultimoMovimento) ultimoMovimento = m.dt_mov; });
      const frescor = { consumo: ultMov.data && ultMov.data[0] ? ultMov.data[0].atualizado_em : null, posicao: ultimaPosicao, ultimoMovimento };
      const porCod = {}; movs.forEach(m => { (porCod[m.codigo] = porCod[m.codigo] || []).push(m); });
      const fis = {}; estoque.forEach(e => { fis[e.codigo] = (fis[e.codigo] || 0) + Number(e.quantidade || 0); });
      const posic = {}; pos.forEach(p => { posic[p.codigo] = p; });
      setCfg(c.data); setEdit(c.data);
      const fabricados = new Set(estr.map(x => x.codigo_pai));      // têm estrutura no PCP = fabricados aqui, não comprados
      setD({ prods, porCod, fis, posic, fabricados, cursor: cur.data || {}, nMovs: movs.length, frescor });
      setErro(null);
    } catch (e) { setErro(e.message || String(e)); }
  }, [sb, perm.custo]);
  React.useEffect(() => { carregar(); }, [carregar]);

  const linhas = React.useMemo(() => {
    if (!d || !cfg) return [];
    const hoje = repHojeBrasilia();
    return d.prods.map(p => {
      const ps = d.posic[p.codigo];
      let r = window.PcpReposicao.calcularItem({
        codigo: p.codigo, movs: d.porCod[p.codigo], hoje, cfg,
        disponivel: ps ? ps.disponivel : (d.fis[p.codigo] || 0), pendente: ps ? ps.pendente : 0,
      });
      if (p.nao_repor) r = { ...r, status: 'nao_repor', sugestao: 0, excesso: 0 };      // marcado pela equipe: fora de sugestões e alertas
      const m3un = (Number(p.altura_cm) * Number(p.largura_cm) * Number(p.profundidade_cm)) / 1e6;
      const custo = perm.custo ? rpCustoEfetivo(p) : null;
      return { ...r, p, custo, m3un: m3un > 0 ? m3un : null, fabricado: d.fabricados.has(p.codigo) };
    });
  }, [d, cfg, perm.custo]);

  if (erro) return <div style={{ padding: 16, color: 'var(--vp-danger)' }}>Não foi possível carregar: {erro}</div>;
  if (!d || !cfg) return <div style={{ padding: 24, color: 'var(--fg3)' }}>Carregando…</div>;

  const doGrupo = linhas.filter(l => grupo === 'todos' || (grupo === 'fabricados' ? l.fabricado : !l.fabricado));
  const cont = (s) => doGrupo.filter(l => l.status === s).length;
  const q = busca.trim().toLowerCase();
  const lista = doGrupo
    .filter(l => statusF === 'todos' ? true : statusF === 'acao' ? (l.status === 'critico' || l.status === 'comprar') : l.status === statusF)
    .filter(l => !q || (l.codigo + ' ' + (l.p.descricao || '') + ' ' + (l.p.familia || '')).toLowerCase().includes(q))
    .sort((a, b) => {
      const padrao = REP_STATUS[a.status].ordem - REP_STATUS[b.status].ordem || (a.coberturaProj ?? 1e9) - (b.coberturaProj ?? 1e9) || a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true });
      if (!ordem) return padrao;
      const va = repValorOrd(a, ordem.col), vb = repValorOrd(b, ordem.col);
      const c = typeof va === 'string' ? va.localeCompare(vb, 'pt-BR', { numeric: true }) : va - vb;
      return (c * (ordem.dir === 'desc' ? -1 : 1)) || padrao;
    });
  const ordenarPor = (col) => setOrdem(o => !o || o.col !== col ? { col, dir: 'asc' } : o.dir === 'asc' ? { col, dir: 'desc' } : null);
  const seta = (col) => ordem && ordem.col === col ? (ordem.dir === 'asc' ? ' ▲' : ' ▼') : '';
  const thOrd = (col, rot, extra) => <th style={{ cursor: 'pointer', userSelect: 'none', ...(extra || {}) }} title="Clique para ordenar" onClick={() => ordenarPor(col)}>{rot}{seta(col)}</th>;

  const marcados = lista.filter(l => sel.has(l.codigo));
  // Valor e cubagem só do que é COMPRADO: item fabricado ("Produzir") não vira compra.
  const base = (marcados.length ? marcados : doGrupo.filter(l => l.sugestao > 0)).filter(l => !l.fabricado);
  const valor = base.reduce((s, l) => s + (l.custo > 0 ? l.sugestao * l.custo : 0), 0);
  const semCustoN = base.filter(l => l.sugestao > 0 && perm.custo && !(l.custo > 0)).length;
  const m3 = base.reduce((s, l) => s + (l.m3un ? l.sugestao * l.m3un : 0), 0);
  const semDimN = base.filter(l => l.sugestao > 0 && !l.m3un).length;
  const alternar = (cod) => setSel(prev => { const n = new Set(prev); if (n.has(cod)) n.delete(cod); else n.add(cod); return n; });
  const todosMarcados = lista.length > 0 && lista.every(l => sel.has(l.codigo));
  const marcarTodos = () => setSel(prev => { const n = new Set(prev); if (todosMarcados) lista.forEach(l => n.delete(l.codigo)); else lista.forEach(l => n.add(l.codigo)); return n; });

  const chamar = async (body) => {
    const { data, error } = await sb.functions.invoke('sync-pcp-consumo', { body });
    if (error) {
      let det = error.message; try { const j = await error.context.json(); if (j?.error) det = j.error; } catch { /* sem corpo */ }
      throw new Error(det);
    }
    if (!data?.ok) throw new Error(data?.error || 'Falha na leitura do Omie');
    return data;
  };
  const atualizar = async () => {
    try {
      const modo = d.cursor.concluido_ate ? 'recente' : 'historico';
      for (let i = 1; i <= 15; i++) {
        setAtualizando(modo === 'historico' ? `Lendo o histórico de consumo do Omie… (etapa ${i}; pode levar alguns minutos na primeira vez)` : 'Atualizando o consumo recente…');
        const r = await chamar({ modo, dias: 45 });
        if (r.concluido) break;
      }
      setAtualizando('Lendo o que está a caminho…');
      await chamar({ modo: 'posicao' });
      await carregar();
      window.toast?.('Reposição atualizada com os dados do Omie.', 'success');
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setAtualizando(null); }
  };

  const salvarCfg = async () => {
    const n = (v) => Math.max(0, Math.round(Number(v) || 0));
    const corpo = {
      prazo_importado_dias: Math.max(1, n(edit.prazo_importado_dias)), prazo_nacional_dias: Math.max(1, n(edit.prazo_nacional_dias)),
      folga_dias: n(edit.folga_dias), ciclo_dias: n(edit.ciclo_dias),
      origens_excluidas: String(edit.origens_excluidas || '').toUpperCase().replace(/\s+/g, ''),
      atualizado_em: new Date().toISOString(), atualizado_por: window.__VP_USER?.email || null,
    };
    setSalvando(true);
    try {
      const { data, error } = await sb.from('pcp_reposicao_config').update(corpo).eq('id', true).select('id');
      if (error) throw error;
      if (!data || !data.length) throw new Error('Nada foi gravado (sem permissão).');
      window.VPLog?.registrar?.({ modulo: 'Almoxarifado', acao: 'Alterou parâmetros da Reposição', alvo: `importado ${corpo.prazo_importado_dias}d · nacional ${corpo.prazo_nacional_dias}d · folga ${corpo.folga_dias}d · ciclo ${corpo.ciclo_dias}d` });
      window.toast?.('Parâmetros salvos.', 'success');
      await carregar();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
    finally { setSalvando(false); }
  };

  // Compra ao Omie: só item COMPRADO com sugestão (fabricado "Produzir" não é comprado).
  const compraSel = marcados.filter(l => l.sugestao > 0 && !l.fabricado);
  const abrirCompra = () => {
    const ignorados = marcados.length - compraSel.length;
    if (ignorados > 0) window.toast?.(`${ignorados} item(ns) marcado(s) ficaram de fora (sem sugestão de compra ou fabricados pelo PCP).`);
    setComprando(compraSel.map(l => ({
      codigo: l.codigo, descricao: l.p.descricao, unidade: l.p.unidade, quantidade: l.sugestao,
      obs: `Reposição: consumo ${repFmt(l.mediaMensal, 1)}/mês · cobertura ${l.coberturaProj != null ? repFmt(l.coberturaProj, 0) : '—'}d · prazo ${l.prazo}d`,
    })));
  };
  const alternarNaoRepor = async (l) => {
    const marcar = !l.p.nao_repor;
    let motivo = null;
    if (marcar) {
      motivo = window.prompt(`Marcar ${l.codigo} como "não repor"?\nEle sai das sugestões e dos alertas de compra. Qual o motivo? (ex.: descontinuado, só sob encomenda)`, '');
      if (motivo === null) return;
      motivo = motivo.trim() || null;
    }
    try {
      const corpo = marcar
        ? { nao_repor: true, nao_repor_motivo: motivo, nao_repor_por: window.__VP_USER?.email || null, nao_repor_em: new Date().toISOString() }
        : { nao_repor: false, nao_repor_motivo: null, nao_repor_por: null, nao_repor_em: null };
      const { data, error } = await sb.from('pcp_produtos').update(corpo).eq('codigo', l.codigo).select('codigo');
      if (error) throw error;
      if (!data || !data.length) throw new Error('Nada foi gravado (sem permissão).');
      window.VPLog?.registrar?.({ modulo: 'Almoxarifado', acao: marcar ? 'Marcou item como "não repor"' : 'Voltou a repor item', alvo: l.codigo, detalhe: motivo || undefined });
      window.toast?.(marcar ? `${l.codigo} não será mais sugerido para compra.` : `${l.codigo} voltou a entrar na reposição.`, 'success');
      await carregar();
    } catch (e) { window.toast?.('Erro: ' + (e.message || e), 'error'); }
  };

  const exportar = () => {
    const cab = ['Código', 'Descrição', 'Unidade', 'Situação', 'Consumo/mês (12m)', 'Prazo (dias)', 'Disponível', 'A caminho', 'Cobertura (dias)', 'Pedir quando ≤', 'Máximo', 'Sugestão', ...(perm.custo ? ['Custo unit.', 'Valor'] : []), 'm³ da sugestão', 'Última saída', 'Origem'];
    const n = (v, d = 2) => v == null || !isFinite(v) ? '' : Number(v).toFixed(d).replace('.', ',');
    const linhasCsv = lista.map(l => [
      l.codigo, l.p.descricao, l.p.unidade, (l.fabricado && (l.status === 'critico' || l.status === 'comprar') ? 'Produzir' : REP_STATUS[l.status].label),
      n(l.mediaMensal, 1), l.prazo, n(l.disponivel), n(l.aCaminho), l.coberturaProj != null ? Math.round(l.coberturaProj) : '', n(l.pedido, 1), n(l.maximo, 1), l.sugestao || '',
      ...(perm.custo ? [l.custo > 0 ? n(l.custo) : '', l.sugestao > 0 && l.custo > 0 ? n(l.sugestao * l.custo) : ''] : []),
      l.sugestao > 0 && l.m3un ? n(l.sugestao * l.m3un) : '', repMesBR(l.ultimoConsumo) === '—' ? '' : repMesBR(l.ultimoConsumo), l.fabricado ? 'Fabricado' : (l.nacional ? 'Nacional' : 'Importado'),
    ]);
    repBaixar(`reposicao-${repHojeBrasilia()}.csv`, repCsv([cab, ...linhasCsv]));
  };
  const btn = (ativo) => 'btn btn--sm' + (ativo ? ' btn--primary' : '');
  const filtro =(id, rot, n) => <button key={id} className={btn(statusF === id)} onClick={() => setStatusF(id)}>{rot}{n != null ? ` (${n})` : ''}</button>;
  const nAcao = cont('critico') + cont('comprar');
  const lido = d.cursor.concluido_ate ? repData(d.cursor.concluido_ate) : null;
  const fr = d.frescor || {};
  const horasDesde = (iso) => iso ? (Date.now() - new Date(iso).getTime()) / 3.6e6 : Infinity;
  const defasado = horasDesde(fr.consumo) > REP_DEFASADO_H || horasDesde(fr.posicao) > REP_DEFASADO_H;
  const campo = (k, rot, hint) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>{rot}
      <input className="input" style={{ width: 130 }} value={edit[k] ?? ''} disabled={!perm.config} onChange={e => setEdit({ ...edit, [k]: e.target.value })}/>
      {hint && <span style={{ fontSize: 11, color: 'var(--fg3)' }}>{hint}</span>}
    </label>
  );

  return (
    <div>
      {comprando && <PcpModalCompra itens={comprando} requisicoes={reqs} onClose={() => setComprando(null)} onEnviado={recarregarReqs}/>}
      {!lido && (
        <div style={{ padding: 12, marginBottom: 12, border: '1px solid var(--vp-warning)', borderRadius: 8, fontSize: 13 }}>
          O histórico de consumo ainda não foi carregado por completo. Clique em <b>Atualizar do Omie</b> (leva alguns minutos na primeira vez; depois é automático todo dia de madrugada).
        </div>
      )}

      <div style={{ padding: defasado ? 10 : 0, marginBottom: 8, border: defasado ? '1px solid var(--vp-warning)' : 'none', borderRadius: 8, fontSize: 12, color: defasado ? 'var(--fg1)' : 'var(--fg3)' }}>
        {defasado && <b>⚠ Dados desatualizados — clique em "Atualizar do Omie". </b>}
        Consumo atualizado em {repDataHora(fr.consumo)} (último movimento: {repData(fr.ultimoMovimento)}) · posição de estoque e "a caminho" em {repDataHora(fr.posicao)}. A atualização automática roda todo dia de madrugada.
      </div>

      <div className="grid-4" style={{ marginBottom: 12 }}>
        <div className="pcp-total"><div className="pcp-total__l">Críticos</div><div className="pcp-total__v" style={{ color: 'var(--vp-danger)' }}>{cont('critico')}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>vão faltar antes da próxima chegada</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Comprar agora</div><div className="pcp-total__v">{cont('comprar')}</div><div style={{ fontSize: 11, color: 'var(--fg3)' }}>no ponto de pedido</div></div>
        <div className="pcp-total"><div className="pcp-total__l">{perm.custo ? (semCustoN ? 'Valor da compra sugerida (mínimo)' : 'Valor da compra sugerida') : 'Compra sugerida (itens)'}</div>
          <div className="pcp-total__v">{perm.custo ? (semCustoN ? '≥ ' : '') + repMoeda(valor) : repFmt(base.filter(l => l.sugestao > 0).length)}</div>
          <div style={{ fontSize: 11, color: semCustoN ? 'var(--vp-warning)' : 'var(--fg3)' }}>{marcados.length ? `${marcados.length} marcado(s)` : 'todos os comprados críticos/comprar'}{semCustoN ? ` · ${semCustoN} item(ns) sem custo ficaram de fora da soma` : ''}</div></div>
        <div className="pcp-total"><div className="pcp-total__l">Cubagem do container</div><div className="pcp-total__v">{repFmt(m3, 1)} m³</div>
          <div style={{ fontSize: 11, color: 'var(--fg3)' }}>{repFmt((m3 / REP_M3_40HC) * 100, 0)}% de um 40'HC (≈{REP_M3_40HC} m³){semDimN ? ` · ${semDimN} sem dimensão (cadastre no Omie)` : ''}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'center' }}>
        {filtro('acao', 'Precisa agir', nAcao)}{filtro('critico', 'Críticos', cont('critico'))}{filtro('comprar', 'Comprar', cont('comprar'))}{filtro('ok', 'OK', cont('ok'))}{filtro('excesso', 'Excesso', cont('excesso'))}{filtro('sem_giro', 'Sem giro', cont('sem_giro'))}{cont('nao_repor') > 0 && filtro('nao_repor', 'Não repor', cont('nao_repor'))}{filtro('todos', 'Todos', null)}
        <span style={{ width: 8 }}/>
        <button className={btn(grupo === 'comprados')} onClick={() => setGrupo('comprados')} title="Itens que a empresa compra (sem estrutura própria)">Comprados</button>
        <button className={btn(grupo === 'fabricados')} onClick={() => setGrupo('fabricados')} title="Itens fabricados pelo PCP (têm estrutura): a reposição de verdade está nos componentes">Fabricados</button>
        <button className={btn(grupo === 'todos')} onClick={() => setGrupo('todos')}>Todos</button>
        <input className="input" style={{ minWidth: 200, marginLeft: 'auto' }} placeholder="Buscar código, descrição ou família…" value={busca} onChange={e => setBusca(e.target.value)}/>
        <button className="btn btn--sm" onClick={() => setCfgAberta(v => !v)}>Parâmetros</button>
        <button className="btn btn--sm" disabled={!lista.length} title="Baixa a lista que está na tela (com os filtros aplicados) em planilha CSV" onClick={exportar}>Exportar planilha</button>
        <button className="btn btn--sm" disabled={!compraSel.length} title="Marque itens na tabela. Mostra uma simulação antes de enviar; nada vai ao Omie sem confirmação." onClick={abrirCompra}>Enviar compra ao Omie ({compraSel.length})</button>
        <button className="btn btn--sm btn--primary" disabled={!!atualizando} onClick={atualizar}>{atualizando ? 'Atualizando…' : 'Atualizar do Omie'}</button>
      </div>
      {atualizando && <div style={{ fontSize: 12, color: 'var(--fg3)', marginBottom: 8 }}>{atualizando}</div>}

      {cfgAberta && (
        <Card title="Parâmetros da reposição" sub={perm.config ? 'Valem para todos os itens. Salvar recalcula a tela.' : 'Somente leitura (sem a alçada de parâmetros da reposição).'}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: 12, alignItems: 'flex-end' }}>
            {campo('prazo_importado_dias', 'Prazo importado (dias)', 'até chegar')}
            {campo('prazo_nacional_dias', 'Prazo nacional (dias)', 'código termina em "n"')}
            {campo('folga_dias', 'Folga (dias)', 'segurança acima do prazo')}
            {campo('ciclo_dias', 'Ciclo / container (dias)', 'consumo extra por compra')}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>Origens fora do consumo
              <input className="input" style={{ width: 230 }} value={edit.origens_excluidas ?? ''} disabled={!perm.config} onChange={e => setEdit({ ...edit, origens_excluidas: e.target.value })}/>
              <span style={{ fontSize: 11, color: 'var(--fg3)' }}>códigos do Omie separados por vírgula (COM = compra…)</span>
            </label>
            {perm.config && <button className="btn btn--sm btn--primary" disabled={salvando} onClick={salvarCfg}>{salvando ? 'Salvando…' : 'Salvar parâmetros'}</button>}
          </div>
        </Card>
      )}

      <Card title="Reposição por consumo real" sub={`${lista.length} item(ns) · histórico desde ${repData(cfg.janela_desde)}${lido ? ` · lido até ${lido}` : ''} · ${repFmt(d.nMovs)} movimentos`}>
        <div className="table-wrap">
          <table className="t pcp-grid">
            <thead><tr>
              <th style={{ width: 28 }}><input type="checkbox" checked={todosMarcados} onChange={marcarTodos} title="Marcar todos os itens da lista"/></th>
              {thOrd('item', 'Item')}{thOrd('situacao', 'Situação')}{thOrd('consumo', 'Consumo/mês', { textAlign: 'right' })}{thOrd('prazo', 'Prazo', { textAlign: 'right' })}
              {thOrd('disp', 'Disponível', { textAlign: 'right' })}{thOrd('caminho', 'A caminho', { textAlign: 'right' })}
              {thOrd('cobertura', 'Cobertura', { textAlign: 'right' })}{thOrd('pedido', 'Pedir quando ≤', { textAlign: 'right' })}{thOrd('maximo', 'Máximo', { textAlign: 'right' })}
              {thOrd('sugestao', 'Sugestão', { textAlign: 'right' })}{perm.custo && thOrd('valor', 'Valor', { textAlign: 'right' })}{thOrd('m3', 'm³', { textAlign: 'right' })}
            </tr></thead>
            <tbody>
              {lista.slice(0, 400).map(l => {
                const st = REP_STATUS[l.status];
                const nCols = perm.custo ? 13 : 12;
                return (<React.Fragment key={l.codigo}>
                  <tr>
                    <td><input type="checkbox" checked={sel.has(l.codigo)} onChange={() => alternar(l.codigo)}/></td>
                    <td style={{ minWidth: 220, cursor: 'pointer' }} title="Clique para ver o consumo mês a mês" onClick={() => setAberto(aberto === l.codigo ? null : l.codigo)}>
                      <span style={{ color: 'var(--fg3)', marginRight: 4 }}>{aberto === l.codigo ? '▾' : '▸'}</span><b style={{ fontWeight: 500 }}>{l.codigo}</b>
                      <div style={{ fontSize: 11, color: 'var(--fg3)', marginLeft: 14 }}>{l.p.descricao}</div>
                    </td>
                    <td><Badge variant={st.variant}>{l.fabricado && (l.status === 'critico' || l.status === 'comprar') ? 'Produzir' : st.label}</Badge>{l.semGiroRecente ? <div style={{ fontSize: 10, color: 'var(--fg3)' }} title="Parou de sair do estoque: sem sugestão de compra.">sem saída há {l.mesesSemSaida} meses</div> : null}{l.status === 'nao_repor' && l.p.nao_repor_motivo ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>{l.p.nao_repor_motivo}</div> : null}{l.fabricado ? <div style={{ fontSize: 10, color: 'var(--fg3)' }} title="Tem estrutura no PCP: é fabricado, o prazo de importação não se aplica; veja os componentes.">fabricado</div> : null}{l.faltaAntesDeChegar && l.status === 'ok' ? <div style={{ fontSize: 10, color: 'var(--fg3)' }} title="O estoque em mãos acaba antes do prazo de chegada; depende do que está a caminho.">depende do que vem</div> : null}</td>
                    <td style={{ textAlign: 'right' }}>{l.mediaMensal > 0 ? repFmt(l.mediaMensal, 1) : '—'}{l.tendencia === 'alta' ? <span title="Últimos 6 meses acima da média" style={{ color: 'var(--vp-danger)' }}> ▲</span> : l.tendencia === 'baixa' ? <span title="Últimos 6 meses abaixo da média" style={{ color: 'var(--fg3)' }}> ▼</span> : null}{l.historicoCurto ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>histórico curto</div> : null}</td>
                    <td style={{ textAlign: 'right' }}>{l.prazo}d{l.nacional ? <div style={{ fontSize: 10, color: 'var(--fg3)' }}>nacional</div> : null}</td>
                    <td style={{ textAlign: 'right' }}>{repFmt(l.disponivel, 2)}</td>
                    <td style={{ textAlign: 'right' }}>{l.aCaminho ? repFmt(l.aCaminho, 2) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{l.coberturaProj != null ? `${repFmt(l.coberturaProj, 0)}d` : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{l.pedido != null ? repFmt(l.pedido, 1) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{l.maximo != null ? repFmt(l.maximo, 1) : '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{l.sugestao > 0 ? `${repFmt(l.sugestao)} ${l.p.unidade || ''}` : l.excesso > 0 ? <span style={{ fontWeight: 400, color: 'var(--fg3)' }}>+{repFmt(l.excesso)} acima</span> : '—'}<PcpTagRequisicao lista={reqs[l.codigo]}/></td>
                    {perm.custo && <td style={{ textAlign: 'right' }}>{l.sugestao > 0 ? (l.custo > 0 ? repMoeda(l.sugestao * l.custo) : <span title="Sem custo cadastrado">⚠</span>) : '—'}</td>}
                    <td style={{ textAlign: 'right' }}>{l.sugestao > 0 ? (l.m3un ? repFmt(l.sugestao * l.m3un, 2) : <span title="Sem dimensões cadastradas">?</span>) : '—'}</td>
                  </tr>
                  {aberto === l.codigo && (
                    <tr><td colSpan={nCols} style={{ background: 'var(--bg2, rgba(127,127,127,0.06))', padding: 12 }}>
                      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <div style={{ flex: '1 1 360px', minWidth: 280 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Saídas por mês (últimos 24 meses) · linha tracejada = média de 12 meses</div>
                          <RepGraficoConsumo l={l}/>
                        </div>
                        <div style={{ flex: '0 1 300px', fontSize: 12, lineHeight: 1.7 }}>
                          <div>Média 12 meses: <b>{l.mediaMensal > 0 ? repFmt(l.mediaMensal, 1) : '—'}</b> · últimos 6 meses: <b>{l.media6 != null ? repFmt(l.media6, 1) : '—'}</b></div>
                          <div>Última saída: <b>{repMesBR(l.ultimoConsumo)}</b>{l.mesesSemSaida > 0 ? ` (há ${l.mesesSemSaida} mês(es))` : ''}</div>
                          <div>Meses de histórico: <b>{l.meses || 0}</b> · {l.fabricado ? 'fabricado' : l.nacional ? 'nacional' : 'importado'} · prazo {l.prazo}d</div>
                          {l.p.nao_repor && <div>Marcado como <b>não repor</b>{l.p.nao_repor_motivo ? `: ${l.p.nao_repor_motivo}` : ''}</div>}
                          {perm.config
                            ? <button className="btn btn--sm" style={{ marginTop: 6 }} onClick={() => alternarNaoRepor(l)}>{l.p.nao_repor ? 'Voltar a repor este item' : 'Marcar como "não repor"'}</button>
                            : <div style={{ color: 'var(--fg3)' }}>Marcar "não repor" exige a alçada de parâmetros da reposição.</div>}
                        </div>
                      </div>
                    </td></tr>
                  )}
                </React.Fragment>);
              })}
              {lista.length === 0 && <tr><td colSpan={perm.custo ? 13 : 12} style={{ padding: 24, textAlign: 'center', color: 'var(--fg3)' }}>Nenhum item neste filtro.</td></tr>}
            </tbody>
          </table>
        </div>
        {lista.length > 400 && <div style={{ padding: 8, fontSize: 12, color: 'var(--fg3)' }}>Mostrando 400 de {lista.length}; use a busca ou os filtros.</div>}
      </Card>

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--fg3)' }}>
        <b style={{ fontWeight: 500 }}>Como ler:</b> o consumo médio vem das saídas reais do estoque do Omie (vendas, remessas, consumo de OP; devoluções abatem; compras, importações e ajustes manuais de contagem não contam) em meses completos, média dos últimos 12 meses. Item sem saída há 6 meses ou mais vira "Sem giro" e não gera compra. Clique no código do item para ver o consumo mês a mês.
        <b style={{ fontWeight: 500 }}> Posição</b> = disponível + o que já está a caminho. <b style={{ fontWeight: 500 }}>Crítico</b>: a posição não cobre nem o prazo de chegada ({cfg.prazo_importado_dias} dias importado / {cfg.prazo_nacional_dias} nacional).
        <b style={{ fontWeight: 500 }}> Comprar</b>: a posição chegou no ponto de pedido (prazo + {cfg.folga_dias} dias de folga). A sugestão leva a posição até o <b style={{ fontWeight: 500 }}>máximo</b> (prazo + folga + {cfg.ciclo_dias} dias de ciclo). O estoque mínimo do Omie não é usado.
        {!perm.custo && ' Valores aparecem só para quem tem a alçada de custo.'}
      </div>
    </div>
  );
}

Object.assign(window, { AlmoxarifadoReposicao });
