/* ============================================================
   mes-cadastros-store.js — MES · Fase 0 · acesso aos cadastros do chão de fábrica.
   Tabelas: mes_frentes, mes_jornada, mes_operador_posto, e as colunas novas
   de pcp_recursos (frente_codigo = POSTO), pcp_etapas_modelo (tipo, operadores).
   Regras puras em mes-cadastros-calc.js. Nada é apagado: desativa-se (ativo=false).
   Todo update usa .select() e trata "0 linhas" como erro (RLS barrada devolve sem erro).
   ============================================================ */
window.MesCadastrosStore = (() => {
  const sb = () => window.__VP_SB && window.__VP_SB.sb;
  const calc = () => window.MesCadastrosCalc;
  const agora = () => new Date().toISOString();
  const quem = () => (window.__VP_USER && window.__VP_USER.email) || null;
  const log = (acao, alvo, detalhe) => {
    if (window.VPLog) window.VPLog.registrar({ modulo: 'MES · Cadastros', acao, alvo, detalhe });
  };

  function cliente() {
    const c = sb();
    if (!c) throw new Error('Supabase não carregado.');
    return c;
  }
  function falha(error, o) {
    if (error) throw new Error(error.message || 'Falha ao gravar.');
    throw new Error(o || 'Nada foi alterado (sem permissão?).');
  }
  function juntar(erros) { if (erros && erros.length) throw new Error(erros.join(' ')); }

  /* ---------- Frentes ---------- */
  async function listarFrentes() {
    const { data, error } = await cliente().from('mes_frentes').select('*').order('ordem').order('nome');
    if (error) falha(error);
    return data || [];
  }
  async function salvarFrente(id, f) {
    juntar(calc().validarFrente(f));
    const c = cliente();
    const payload = { nome: f.nome.trim(), ordem: Number(f.ordem) || 0, updated_at: agora() };
    if (id) {
      const { data, error } = await c.from('mes_frentes').update(payload).eq('id', id).select('id');
      if (error || !data || !data.length) falha(error);
      log('Editou frente', payload.nome, { id });
    } else {
      const { data, error } = await c.from('mes_frentes').insert({ ...payload, codigo: f.codigo.trim() }).select('id');
      if (error) {
        if (/duplicate|unique/i.test(error.message)) throw new Error('Já existe uma frente com esse código.');
        falha(error);
      }
      if (!data || !data.length) falha(null);
      log('Criou frente', payload.nome, { codigo: f.codigo.trim() });
    }
  }
  async function ativarFrente(f, ativo) {
    const { data, error } = await cliente().from('mes_frentes').update({ ativo, updated_at: agora() }).eq('id', f.id).select('id');
    if (error || !data || !data.length) falha(error);
    log(ativo ? 'Reativou frente' : 'Desativou frente', f.nome, { codigo: f.codigo });
  }

  /* ---------- Postos (= recursos do PCP com frente) ---------- */
  async function listarPostos() {
    const { data, error } = await cliente().from('pcp_recursos').select('id, codigo, nome, tipo, frente_codigo, ativo').order('codigo');
    if (error) falha(error);
    return data || [];
  }
  async function salvarPosto(id, p) {
    juntar(calc().validarPosto(p));
    const c = cliente();
    const base = { nome: p.nome.trim(), tipo: p.tipo, frente_codigo: p.frente_codigo, updated_at: agora() };
    if (id) {
      const { data, error } = await c.from('pcp_recursos').update(base).eq('id', id).select('id');
      if (error || !data || !data.length) falha(error);
      log('Editou posto', `${p.codigo} — ${base.nome}`, { id, frente: base.frente_codigo });
    } else {
      const { data, error } = await c.from('pcp_recursos').insert({ ...base, codigo: p.codigo.trim(), criado_por: quem() }).select('id');
      if (error) {
        if (/duplicate|unique/i.test(error.message)) throw new Error('Já existe um posto/recurso com esse código.');
        falha(error);
      }
      if (!data || !data.length) falha(null);
      log('Criou posto', `${p.codigo} — ${base.nome}`, { frente: base.frente_codigo });
    }
  }
  async function ativarPosto(p, ativo) {
    const { data, error } = await cliente().from('pcp_recursos').update({ ativo, updated_at: agora() }).eq('id', p.id).select('id');
    if (error || !data || !data.length) falha(error);
    log(ativo ? 'Reativou posto' : 'Desativou posto', `${p.codigo} — ${p.nome}`);
  }

  /* ---------- Jornada única ---------- */
  async function obterJornada() {
    const { data, error } = await cliente().from('mes_jornada').select('*').eq('id', true).maybeSingle();
    if (error) falha(error);
    return data;
  }
  async function salvarJornada(j) {
    juntar(calc().validarJornada(j));
    const payload = {
      nome: String(j.nome || 'Horário normal').trim() || 'Horário normal',
      inicio: j.inicio, fim: j.fim, intervalo_min: Number(j.intervalo_min) || 0,
      dias_semana: [...j.dias_semana].sort((a, b) => a - b), updated_at: agora(), updated_by: quem(),
    };
    const { data, error } = await cliente().from('mes_jornada').update(payload).eq('id', true).select('id');
    if (error || !data || !data.length) falha(error);
    log('Editou jornada', payload.nome, { inicio: payload.inicio, fim: payload.fim, intervalo_min: payload.intervalo_min, dias: payload.dias_semana });
  }

  /* ---------- Etapas modelo ---------- */
  async function listarEtapasModelo() {
    const { data, error } = await cliente().from('pcp_etapas_modelo').select('id, posicao, nome, setor, ativo, tipo, operadores').order('posicao');
    if (error) falha(error);
    return data || [];
  }
  async function salvarEtapaModelo(id, e) {
    juntar(calc().validarEtapa(e));
    const payload = { nome: e.nome.trim(), setor: String(e.setor || '').trim() || null, tipo: e.tipo, operadores: Number(e.operadores) };
    const { data, error } = await cliente().from('pcp_etapas_modelo').update(payload).eq('id', id).select('id');
    if (error || !data || !data.length) falha(error);
    log('Editou etapa modelo', payload.nome, { id, tipo: payload.tipo, operadores: payload.operadores });
  }

  /* ---------- Posto padrão do colaborador ---------- */
  async function listarOperadores() {
    const c = cliente();
    const [colab, vinc] = await Promise.all([
      c.from('colaboradores_vpsistema').select('nome, email, departamento, cargo, is_active').eq('is_active', true).order('nome'),
      c.from('mes_operador_posto').select('email, recurso_id'),
    ]);
    if (colab.error) falha(colab.error);
    if (vinc.error) falha(vinc.error);
    const mapa = {};
    (vinc.data || []).forEach(v => { mapa[String(v.email).toLowerCase()] = v.recurso_id; });
    return (colab.data || []).filter(p => p.email).map(p => ({ ...p, recurso_id: mapa[String(p.email).toLowerCase()] || null }));
  }
  async function salvarPostoPadrao(email, recursoId) {
    const c = cliente();
    const chave = String(email).toLowerCase();
    if (!recursoId) {
      const { error } = await c.from('mes_operador_posto').update({ recurso_id: null, updated_at: agora(), updated_by: quem() }).eq('email', chave);
      if (error) falha(error);
    } else {
      const { data, error } = await c.from('mes_operador_posto')
        .upsert({ email: chave, recurso_id: recursoId, updated_at: agora(), updated_by: quem() }, { onConflict: 'email' }).select('email');
      if (error || !data || !data.length) falha(error);
    }
    log(recursoId ? 'Definiu posto padrão' : 'Removeu posto padrão', chave, { recurso_id: recursoId || null });
  }

  return {
    listarFrentes, salvarFrente, ativarFrente,
    listarPostos, salvarPosto, ativarPosto,
    obterJornada, salvarJornada,
    listarEtapasModelo, salvarEtapaModelo,
    listarOperadores, salvarPostoPadrao,
  };
})();
