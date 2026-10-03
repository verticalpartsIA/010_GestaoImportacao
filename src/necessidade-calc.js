/* ============================================================
   necessidade-calc.js — Logística Interna · Almoxarifado · "Necessidade" (funções puras, sem rede).
   Pergunta que responde: para ATENDER O QUE JÁ FOI VENDIDO (carteira de pedidos + ordens avulsas), o que falta de material e
   até quando preciso comprar, dado o prazo de chegada? (A aba Reposição olha o HISTÓRICO; esta olha o COMPROMETIDO.)
   Método (MRP simples, vários níveis):
   1) soma a demanda por produto (pedido/ordem, qtd, previsão de entrega mais cedo);
   2) processa os itens por nível (do produto final para os componentes), de modo que o total pedido de cada item
      esteja completo ANTES de abater o estoque — o estoque de um item compartilhado é abatido uma vez só;
   3) item FABRICADO (tem estrutura): produzir = max(0, necessário − físico); o que produzir vira demanda dos componentes
      (qtd × quantidade da estrutura × (1 + perda%)); a previsão e os pedidos de origem acompanham;
   4) item COMPRADO (sem estrutura): falta = max(0, necessário − (físico + a caminho));
      comprarAte = previsão − prazo; se já passou (previsão − hoje < prazo) fica "atrasado": mesmo comprando hoje não chega a tempo.
   Regras que existem por motivo real:
   - Estoque usado é o FÍSICO, não o disponível: o "reservado" do Omie já inclui reservas dos próprios pedidos que estão
     na demanda; usar o disponível contaria a mesma venda duas vezes.
   - Prazo: código terminado em "n" minúsculo = nacional (mesma regra da Reposição, window.PcpReposicao.ehNacional).
   - Ciclo na estrutura não trava: a aresta que fecha o ciclo é ignorada e o item é listado em `ciclos`.
   Exposto em window.PcpNecessidade.
   ============================================================ */
(function () {
  'use strict';

  // BEGIN CALC — copiado para supabase/functions/alerta-pcp-compras/index.ts; src/alerta-pcp-paridade.test.js confere que seguem idênticos
  const DIA = 86400000;
  const nacional = (codigo) => /n$/.test(String(codigo || ''));
  const t = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const menorData = (a, b) => (!a ? b : !b ? a : (a <= b ? a : b));

  // demanda: [{ codigo, qtd, ref, previsao }]   filhos: { pai: [{ codigo_filho, quantidade, perda_pct }] }
  // estoque: { codigo: { fisico, aCaminho } }   cfg: { prazo_importado_dias, prazo_nacional_dias }
  function calcular({ demanda, filhos, estoque, hoje, cfg }) {
    const need = new Map();   // codigo -> { qtd, refs:Set, previsao }
    const juntar = (cod, qtd, refs, previsao) => {
      const n = need.get(cod) || { qtd: 0, refs: new Set(), previsao: null };
      n.qtd += qtd; refs.forEach(r => n.refs.add(r)); n.previsao = menorData(n.previsao, previsao);
      need.set(cod, n);
    };
    (demanda || []).forEach(d => { if (d.qtd > 0 && d.codigo) juntar(d.codigo, Number(d.qtd), new Set([d.ref]), d.previsao || null); });

    // subgrafo alcançável + ordem por nível (Kahn); aresta que fecha ciclo é ignorada
    const alcance = new Set();
    const visitar = (c) => { if (alcance.has(c)) return; alcance.add(c); (filhos[c] || []).forEach(f => visitar(f.codigo_filho)); };
    Array.from(need.keys()).forEach(visitar);
    const grau = new Map(Array.from(alcance).map(c => [c, 0]));
    alcance.forEach(c => (filhos[c] || []).forEach(f => grau.set(f.codigo_filho, grau.get(f.codigo_filho) + 1)));
    const ordem = []; const fila = Array.from(alcance).filter(c => grau.get(c) === 0);
    while (fila.length) {
      const c = fila.shift(); ordem.push(c);
      (filhos[c] || []).forEach(f => { grau.set(f.codigo_filho, grau.get(f.codigo_filho) - 1); if (grau.get(f.codigo_filho) === 0) fila.push(f.codigo_filho); });
    }
    const ciclos = Array.from(alcance).filter(c => !ordem.includes(c));
    ciclos.forEach(c => ordem.push(c));
    const feitos = new Set();

    const fabricados = [], comprados = [];
    ordem.forEach(cod => {
      feitos.add(cod);
      const n = need.get(cod);
      if (!n || !(n.qtd > 0)) return;
      const e = (estoque && estoque[cod]) || { fisico: 0, aCaminho: 0 };
      const fisico = Number(e.fisico || 0), aCaminho = Number(e.aCaminho || 0);
      const refs = Array.from(n.refs).filter(Boolean);
      const sub = filhos[cod] || [];
      if (sub.length) {
        const produzir = Math.max(0, n.qtd - fisico);
        fabricados.push({ codigo: cod, necessario: n.qtd, fisico, produzir, refs, previsao: n.previsao });
        if (produzir > 0) sub.forEach(f => { if (!feitos.has(f.codigo_filho)) juntar(f.codigo_filho, produzir * Number(f.quantidade || 0) * (1 + Number(f.perda_pct || 0) / 100), n.refs, n.previsao); });
      } else {
        const falta = Math.max(0, n.qtd - (fisico + aCaminho));
        const prazo = nacional(cod) ? cfg.prazo_nacional_dias : cfg.prazo_importado_dias;
        let status = 'coberto', comprarAte = null, diasAtePrevisao = null;
        if (falta > 1e-9) {
          if (!n.previsao) status = 'sem_data';
          else {
            diasAtePrevisao = Math.round((t(n.previsao) - t(hoje)) / DIA);
            comprarAte = iso(t(n.previsao) - prazo * DIA);
            status = diasAtePrevisao - prazo < 0 ? 'atrasado' : 'comprar';
          }
        }
        comprados.push({ codigo: cod, necessario: n.qtd, fisico, aCaminho, falta, prazo, nacional: nacional(cod), previsao: n.previsao, diasAtePrevisao, comprarAte, status, refs });
      }
    });
    const ordemStatus = { atrasado: 0, comprar: 1, sem_data: 2, coberto: 3 };
    comprados.sort((a, b) => ordemStatus[a.status] - ordemStatus[b.status] || String(a.comprarAte || '9').localeCompare(String(b.comprarAte || '9')) || a.codigo.localeCompare(b.codigo));
    fabricados.sort((a, b) => b.produzir - a.produzir || a.codigo.localeCompare(b.codigo));
    return { comprados, fabricados, ciclos };
  }

  // END CALC
  window.PcpNecessidade = { calcular, nacional };
}());
