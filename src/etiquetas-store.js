/* ============================================================
   etiquetas-store.js — Logística Interna · Etiquetas: leitura de endereços/itens e histórico de impressões.
   Spec: docs/superpowers/specs/2026-10-17-modulo-etiquetas-design.md
   Tabela: etiqueta_impressoes (migration 20261017160000) — insert-only (quem imprimiu, o quê, quando), nasce FECHADA:
   só usuário ativo com a alçada etiquetas.ver lê; só quem tem etiquetas.imprimir (ou .reimprimir) grava.
   Regras que existem por motivo:
   - Os endereços vêm de estoque_enderecos (a mesma tabela que o app de estoque usa para recusar endereço inexistente). Se a leitura
     falhar, usa-se a lista gerada pelas regras (EtiquetasCalc.todosEnderecos) e a tela avisa — nunca imprime endereço que não existe.
   - Reimpressão exige motivo (≥ 5 letras) e a alçada etiquetas.reimprimir; o banco confere de novo.
   - Falha ao gravar o histórico NUNCA desfaz uma impressão que já saiu: devolve { ok:false } e a tela avisa.
   window.EtiquetasStore
   ============================================================ */
(function () {
  'use strict';
  const sbCli = () => (window.__VP_SB && window.__VP_SB.sb) || null;

  async function temCapacidade(cap) {
    try { return !!(await window.PropostaStore?.temCapacidade?.('etiquetas', cap)); } catch (e) { return false; }
  }

  async function listarEnderecos() {
    const sb = sbCli();
    const plano = () => ({ origem: 'regras', enderecos: window.EtiquetasCalc.todosEnderecos() });
    if (!sb) return plano();
    try {
      const { data, error } = await sb.from('estoque_enderecos').select('codigo, tipo, rua, vao, nivel, lado').eq('ativo', true).order('codigo').limit(1000);
      if (error || !data || !data.length) return plano();
      return { origem: 'banco', enderecos: data };
    } catch (e) { return plano(); }
  }

  // Busca produto por código ou descrição. Sem texto, não lista nada (são ~1.700 itens).
  async function buscarItens(texto) {
    const sb = sbCli();
    const t = String(texto || '').replace(/[,()%*\\]/g, ' ').trim();
    if (!sb || t.length < 2) return { itens: [], erro: null };
    try {
      const { data, error } = await sb.from('pcp_produtos').select('codigo, descricao, unidade, familia, endereco').eq('ativo', true)
        .or(`codigo.ilike.%${t}%,descricao.ilike.%${t}%`).order('codigo').limit(40);
      if (error) return { itens: [], erro: error.message };
      return { itens: data || [], erro: null };
    } catch (e) { return { itens: [], erro: e.message }; }
  }

  /* reg: { tipo, modelo, referencia, dados:{itens:[{ref,dados,copias}],…}, quantidade, impressora, adaptador, sucesso, erro, reimpressao, motivo } */
  async function registrarImpressao(reg) {
    const sb = sbCli();
    if (!sb) return { ok: false, erro: 'Supabase indisponível.' };
    const linha = {
      tipo: reg.tipo, modelo: reg.modelo, referencia: reg.referencia || null, dados: reg.dados || {}, quantidade: reg.quantidade,
      impressora: reg.impressora || null, adaptador: reg.adaptador || null, sucesso: reg.sucesso !== false, erro: reg.erro || null,
      reimpressao: !!reg.reimpressao, motivo: reg.reimpressao ? String(reg.motivo || '').trim() : null,
    };  // `usuario` fica por conta do banco (default = e-mail do login, conferido pela política de INSERT)
    try {
      const { error } = await sb.from('etiqueta_impressoes').insert(linha);
      if (error) return { ok: false, erro: error.message };
    } catch (e) { return { ok: false, erro: e.message }; }
    try {
      window.VPLog?.registrar?.({ modulo: 'Etiquetas', acao: reg.reimpressao ? 'Reimprimiu etiquetas' : 'Imprimiu etiquetas', alvo: reg.tipo, alvo_id: reg.referencia || null,
        detalhe: { quantidade: reg.quantidade, modelo: reg.modelo, sucesso: reg.sucesso !== false, motivo: linha.motivo } });
    } catch (e) { /* o log global é complemento; o histórico próprio já gravou */ }
    return { ok: true };
  }

  async function listarHistorico(limite) {
    const sb = sbCli();
    if (!sb) return { linhas: [], erro: 'Supabase indisponível.' };
    try {
      const { data, error } = await sb.from('etiqueta_impressoes')
        .select('id, tipo, modelo, referencia, dados, quantidade, impressora, adaptador, sucesso, erro, reimpressao, motivo, usuario, impresso_em')
        .order('impresso_em', { ascending: false }).limit(limite || 200);
      if (error) return { linhas: [], erro: error.message };
      return { linhas: data || [], erro: null };
    } catch (e) { return { linhas: [], erro: e.message }; }
  }

  window.EtiquetasStore = { temCapacidade, listarEnderecos, buscarItens, registrarImpressao, listarHistorico };
}());
