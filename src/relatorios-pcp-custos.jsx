/* ============================================================
   relatorios-pcp-custos.jsx — custo padrão dos produtos vendidos, compartilhado pelos Relatórios do PCP
   (Pedidos, Clientes, Fluxo de Caixa) para mostrar custo, LUCRO e margem junto da receita.
   Regras que existem por motivo real:
   - Custo unitário = custo da estrutura (BOM) × custo ATUAL dos componentes (pcp_produtos.preco_custo), com a perda da
     estrutura; produto sem estrutura usa o próprio preco_custo. NÃO é o custo da data da venda e NÃO inclui mão de obra,
     impostos, frete nem comissão: é LUCRO BRUTO SOBRE MATERIAIS (decisão do usuário: mão de obra fica de fora por ora).
   - Componente sem custo cadastrado entra como 0 e o item é marcado "custo incompleto" (lucro superestimado) — nunca
     esconder isso: sem o aviso o lucro pareceria maior que o real.
   - Só carrega (e só existe) para quem tem a alçada almoxarifado.ver_custo: sem ela nem consulta o dado.
   - CUSTO MANUAL (pcp_produtos.custo_manual): vale só quando o Omie não tem custo (preco_custo ≤ 0). Item que usa custo manual
     ganha o marcador ⓜ (estimado); o ⚠ continua só para componente SEM custo nenhum.
   Usado por relatorios-pcp.jsx e painel-fluxo-pcp.jsx. Depende de rpCustoUnit (relatorios-pcp.jsx).
   ============================================================ */

// Custo efetivo de um produto: o do Omie (preco_custo > 0) tem prioridade; o custo MANUAL (pcp_produtos.custo_manual,
// preenchido no Almoxarifado › Custos) só vale quando o Omie não tem custo. Todas as telas de custo usam esta função.
function rpCustoEfetivo(row) {
  const omie = Number(row && row.preco_custo || 0);
  if (omie > 0) return omie;
  const man = Number(row && row.custo_manual || 0);
  return man > 0 ? man : 0;
}
function rpUsaManual(row) { return !(Number(row && row.preco_custo || 0) > 0) && Number(row && row.custo_manual || 0) > 0; }

// Folhas da estrutura que satisfazem um predicado (ex.: usa custo manual).
function rpFolhasOnde(codigo, filhos, pred, pilha = [], acc = new Set()) {
  const sub = filhos[codigo] || [];
  if (!sub.length) { if (pred(codigo)) acc.add(codigo); return acc; }
  sub.forEach(f => { if (!pilha.includes(f.codigo_filho)) rpFolhasOnde(f.codigo_filho, filhos, pred, [...pilha, codigo], acc); });
  return acc;
}

// Componentes (folhas) sem custo cadastrado dentro da estrutura do produto.
function rpFolhasSemCusto(codigo, filhos, custo, pilha = [], acc = new Set()) {
  const sub = filhos[codigo] || [];
  if (!sub.length) { if (!(Number(custo[codigo] || 0) > 0)) acc.add(codigo); return acc; }
  sub.forEach(f => { if (!pilha.includes(f.codigo_filho)) rpFolhasSemCusto(f.codigo_filho, filhos, custo, [...pilha, codigo], acc); });
  return acc;
}

// Devolve null enquanto carrega (ou sem alçada); depois { custoUn(cod), faltando(cod) -> [códigos sem custo] }.
function useRPCustos(sb, ativo) {
  const [c, setC] = React.useState(null);
  React.useEffect(() => {
    let vivo = true;
    if (!ativo) { setC(null); return; }
    (async () => {
      const [e, p] = await Promise.all([
        sb.from('pcp_estrutura').select('codigo_pai, codigo_filho, quantidade, perda_pct').limit(5000),
        sb.from('pcp_produtos').select('codigo, preco_custo, custo_manual').limit(5000),
      ]);
      const filhos = {}; (e.data || []).forEach(l => { (filhos[l.codigo_pai] = filhos[l.codigo_pai] || []).push(l); });
      const preco = {}, manual = new Set();
      (p.data || []).forEach(l => { preco[l.codigo] = rpCustoEfetivo(l); if (rpUsaManual(l)) manual.add(l.codigo); });
      const memoC = {}, memoF = {}, memoM = {};
      if (vivo) setC({
        custoUn: (cod) => (cod in memoC ? memoC[cod] : (memoC[cod] = rpCustoUnit(cod, filhos, preco))),
        faltando: (cod) => (cod in memoF ? memoF[cod] : (memoF[cod] = Array.from(rpFolhasSemCusto(cod, filhos, preco)))),
        manuais: (cod) => (cod in memoM ? memoM[cod] : (memoM[cod] = Array.from(rpFolhasOnde(cod, filhos, (c) => manual.has(c))))),
      });
    })();
    return () => { vivo = false; };
  }, [sb, ativo]);
  return c;
}

// Custo e lucro de uma linha vendida { codigo, quantidade, valor_total }.
function rpLinhaCusto(custos, l) {
  const un = custos.custoUn(l.codigo), falta = custos.faltando(l.codigo), manuais = custos.manuais(l.codigo);
  const custo = Number(l.quantidade || 0) * un, receita = Number(l.valor_total || 0);
  return { custo, lucro: receita - custo, margem: receita > 0 ? ((receita - custo) / receita) * 100 : null, incompleto: falta.length > 0, falta, manuais };
}
function RPAvisoCusto({ falta, manuais }) {
  return (<>
    {falta && falta.length > 0 && <span title={`Sem custo cadastrado: ${falta.join(', ')}. O lucro deste item está superestimado.`} style={{ color: 'var(--vp-yellow)', cursor: 'help', marginLeft: 4 }}>⚠</span>}
    {manuais && manuais.length > 0 && <span title={`Inclui custo MANUAL (estimado, não vem do Omie): ${manuais.join(', ')}.`} style={{ color: 'var(--fg3)', cursor: 'help', marginLeft: 4 }}>ⓜ</span>}
  </>);
}

Object.assign(window, { rpCustoEfetivo, rpUsaManual, rpFolhasOnde, rpFolhasSemCusto, useRPCustos, rpLinhaCusto, RPAvisoCusto });
