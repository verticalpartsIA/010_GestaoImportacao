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
   Usado por relatorios-pcp.jsx e painel-fluxo-pcp.jsx. Depende de rpCustoUnit (relatorios-pcp.jsx).
   ============================================================ */

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
        sb.from('pcp_produtos').select('codigo, preco_custo').limit(5000),
      ]);
      const filhos = {}; (e.data || []).forEach(l => { (filhos[l.codigo_pai] = filhos[l.codigo_pai] || []).push(l); });
      const preco = {}; (p.data || []).forEach(l => { preco[l.codigo] = Number(l.preco_custo || 0); });
      const memoC = {}, memoF = {};
      if (vivo) setC({
        custoUn: (cod) => (cod in memoC ? memoC[cod] : (memoC[cod] = rpCustoUnit(cod, filhos, preco))),
        faltando: (cod) => (cod in memoF ? memoF[cod] : (memoF[cod] = Array.from(rpFolhasSemCusto(cod, filhos, preco)))),
      });
    })();
    return () => { vivo = false; };
  }, [sb, ativo]);
  return c;
}

// Custo e lucro de uma linha vendida { codigo, quantidade, valor_total }.
function rpLinhaCusto(custos, l) {
  const un = custos.custoUn(l.codigo), falta = custos.faltando(l.codigo);
  const custo = Number(l.quantidade || 0) * un, receita = Number(l.valor_total || 0);
  return { custo, lucro: receita - custo, margem: receita > 0 ? ((receita - custo) / receita) * 100 : null, incompleto: falta.length > 0, falta };
}
function RPAvisoCusto({ falta }) {
  if (!falta || !falta.length) return null;
  return <span title={`Sem custo cadastrado: ${falta.join(', ')}. O lucro deste item está superestimado.`} style={{ color: 'var(--vp-yellow)', cursor: 'help', marginLeft: 4 }}>⚠</span>;
}

Object.assign(window, { rpFolhasSemCusto, useRPCustos, rpLinhaCusto, RPAvisoCusto });
