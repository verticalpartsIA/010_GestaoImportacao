/* ============================================================
   projeto-elevador-store.js
   "Projeto de Elevadores" (Engenharia) — trata/traduz os desenhos
   técnicos que o fornecedor manda junto da cotação (poço, cabine,
   porta, COP/LOP), correlacionado pelo Nº da Cotação.
   Tabela: projetos_elevador · bucket: engenharia (mesmo já usado por
   engenharia-config.jsx). window.ProjetoElevadorStore
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async function listarTodas() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('projetos_elevador').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('[ProjetoElevador] listarTodas falhou', error); return []; }
    return data || [];
  }

  async function listarPorCotacao(numeroCotacao) {
    const c = sb(); if (!c || numeroCotacao == null) return [];
    const { data, error } = await c.from('projetos_elevador')
      .select('*').eq('numero_cotacao', numeroCotacao).order('created_at', { ascending: false });
    if (error) { console.warn('[ProjetoElevador] listarPorCotacao falhou', error); return []; }
    return data || [];
  }

  async function salvar({ id, isNew, numeroCotacao, cotacaoFornecedorId, referencia, responsavel, status, unidades, anexos, observacoes }) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    if (!referencia?.trim()) throw new Error('Referência (prédio/empreendimento) é obrigatória.');
    const row = {
      numero_cotacao: numeroCotacao ?? null,
      cotacao_fornecedor_id: cotacaoFornecedorId || null,
      referencia: referencia.trim(),
      responsavel: responsavel || null,
      status: status || 'rascunho',
      unidades: unidades || [],
      anexos: anexos || [],
      observacoes: observacoes || null,
      updated_at: new Date().toISOString(),
    };
    /* `id` vem sempre preenchido (pré-gerado no modal pra correlacionar
       anexos antes do 1º save) — quem decide insert vs. update é `isNew`,
       não a presença de `id` (senão o insert nunca acontece e todo projeto
       novo vira um update que não bate em nenhuma linha). */
    const q = isNew
      ? c.from('projetos_elevador').insert({ id: id || uuid(), ...row }).select().single()
      : c.from('projetos_elevador').update(row).eq('id', id).select().single();
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (isNew && window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'PROJETO_ELEVADOR_CRIADO', numeroCotacao: data.numero_cotacao,
      alvoLabel: data.referencia, alvoId: data.id,
    });
    return data;
  }

  async function finalizar(id) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    const { data, error } = await c.from('projetos_elevador')
      .update({ status: 'finalizado', updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    if (window.EventosFluxo) window.EventosFluxo.registrar({
      evento: 'PROJETO_ELEVADOR_FINALIZADO', numeroCotacao: data.numero_cotacao,
      alvoLabel: data.referencia, alvoId: data.id,
    });
    return data;
  }

  async function uploadAnexo(id, file) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    const path = `${id}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
    const { error } = await c.storage.from('engenharia').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = c.storage.from('engenharia').getPublicUrl(path);
    return { nome: file.name, url: data.publicUrl, tipo: file.type, tamanho: file.size, path };
  }

  async function removerAnexo(path) {
    const c = sb(); if (!c || !path) return;
    await c.storage.from('engenharia').remove([path]);
  }

  /* ---------- Repositório de desenhos (aba "Desenhos") ----------
     Tabela projetos_elevador_desenhos, independente do formulário acima.
     Uma linha por arquivo; exclusão = soft-delete. */
  const DESENHO_MAX_BYTES = 25 * 1024 * 1024;
  const DESENHO_EXT = /\.(pdf|png|jpe?g|dwg|dxf)$/i;

  async function listarDesenhos() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('projetos_elevador_desenhos').select('*')
      .is('excluido_em', null).order('criado_em', { ascending: false }).limit(1000);
    if (error) throw new Error(error.message);
    return data || [];
  }

  /* Códigos dos equipamentos da obra (VPEL-EL0955-1, -2…). Fontes, na ordem de confiança:
     Proposta (data_json.ativos[].codigo) → Precificação (mo_lookup[].identificador, 1 linha por
     equipamento físico) → identificador da Unidade do Formulário. Une tudo sem repetir. */
  async function equipamentosDaObra(numeroCotacao, unidades) {
    const c = sb(); const cods = new Set();
    const add = (v) => { const t = String(v || '').trim().toUpperCase(); if (t) cods.add(t); };
    try {
      const { data } = await c.from('propostas').select('data_json').eq('numero_cotacao', numeroCotacao);
      (data || []).forEach(p => ((p.data_json || {}).ativos || []).forEach(a => add(a.codigo)));
    } catch (e) { console.warn('[ProjetoElevador] ativos da proposta', e); }
    try {
      const { data } = await c.from('precificacoes_elevador').select('mo_lookup').eq('numero_cotacao', numeroCotacao);
      (data || []).forEach(p => (p.mo_lookup || []).forEach(m => add(m.identificador)));
    } catch (e) { console.warn('[ProjetoElevador] mo_lookup', e); }
    (unidades || []).forEach(u => add(u.identificador));
    return Array.from(cods).filter(x => /^VP[A-Z]*-/.test(x) || cods.size === 1).sort((a, b) => a.localeCompare(b, 'pt', { numeric: true }));
  }

  /* Busca a OBRA pela Nº da cotação (formulário que originou o negócio) com o cliente
     vinculado. Passa por FormularioElevadorStore.obter, que já aplica a regra de dono
     (vendedor só abre o que criou, salvo alçada `formularios.ver_de_outros`) — se a
     cotação for de outro vendedor, o erro dessa regra sobe pra tela. */
  async function buscarObraPorCotacao(numero) {
    const c = sb(); if (!c || !(Number(numero) > 0)) return null;
    const { data, error } = await c.from('formularios_elevador').select('id').eq('numero_cotacao', Number(numero)).limit(1);
    if (error) throw new Error(error.message);
    if (!data || !data.length) return null;
    const f = await window.FormularioElevadorStore.obter(data[0].id);
    const equipamentos = await equipamentosDaObra(f.numero_cotacao, f.unidades);
    return {
      equipamentos,
      formularioId: f.id, numeroCotacao: f.numero_cotacao,
      predio: f.predio_empreendimento || '', cidade: f.local_obra_cidade || '', uf: f.local_obra_estado || '',
      enderecoObra: f.endereco_obra || '',
      clienteId: f.cliente_id || null, clienteNome: f.razao_social || f.nome_fantasia || '',
      clienteDocumento: f.cnpj || f.cpf || '',
    };
  }

  /* Cliente cadastrado pelo CPF/CNPJ (só dígitos, 11 ou 14). */
  async function buscarClientePorDocumento(doc) {
    const d = String(doc || '').replace(/\D/g, '');
    if (d.length !== 11 && d.length !== 14) return null;
    const lista = (await window.CadastrosClientesStore?.listarTodos()) || [];
    const achados = lista.filter(cl => String(cl.cnpj || cl.cpf || '').replace(/\D/g, '') === d);
    if (!achados.length) return null;
    const cl = achados[0];
    return { id: cl.id, nome: cl.razao_social || cl.nome_fantasia || '', documento: cl.cnpj || cl.cpf || '' };
  }

  /* Obras (formulários) de um cliente — mesma regra de dono da busca por cotação. */
  async function obrasDoCliente(clienteId) {
    const c = sb(); if (!c || !clienteId) return [];
    const { data, error } = await c.from('formularios_elevador')
      .select('id, numero_cotacao, predio_empreendimento, local_obra_cidade, local_obra_estado, created_by')
      .eq('cliente_id', clienteId).order('numero_cotacao', { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    const eu = String((window.__VP_USER || {}).email || '').trim().toLowerCase();
    let vtudo = !eu;
    if (!vtudo && window.PropostaStore?.temCapacidade) vtudo = !!(await window.PropostaStore.temCapacidade('formularios', 'ver_de_outros'));
    else if (!vtudo) vtudo = true;
    return (data || []).filter(f => vtudo || !f.created_by || String(f.created_by).trim().toLowerCase() === eu)
      .map(f => ({ formularioId: f.id, numeroCotacao: f.numero_cotacao, predio: f.predio_empreendimento || '',
        cidade: f.local_obra_cidade || '', uf: f.local_obra_estado || '' }));
  }

  const DESENHO_TIPOS = { projeto_instalacao: 'Projeto de Instalação', id_tag: 'ID-TAG' };

  /* docs = [{ tipo: 'projeto_instalacao'|'id_tag', files: File[] }]; equipamentos = ['VPEL-EL0955-1', ...] */
  async function salvarDesenhos({ referencia, clienteNome, numeroCotacao, observacao, docs, equipamentos, formularioId, clienteId, clienteDocumento }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!referencia || !referencia.trim()) throw new Error('Informe o prédio/empreendimento.');
    const equips = Array.from(new Set((equipamentos || []).map(e => String(e || '').trim().toUpperCase()).filter(Boolean)));
    if (!equips.length) throw new Error('Informe o código do equipamento (ex.: VPEL-EL0955-1).');
    const lote = [];
    (docs || []).forEach(d => (d.files || []).forEach(f => lote.push({ tipo: d.tipo, file: f })));
    if (!lote.length) throw new Error('Anexe o Projeto de Instalação e/ou o ID-TAG.');
    for (const { tipo, file: f } of lote) {
      if (tipo === 'id_tag' && !/\.pdf$/i.test(f.name)) throw new Error(`ID-TAG deve ser um PDF ("${f.name}").`);
      if (!DESENHO_EXT.test(f.name)) throw new Error(`"${f.name}": use PDF, PNG, JPG, DWG ou DXF.`);
      if (f.size > DESENHO_MAX_BYTES) throw new Error(`"${f.name}" passa de 25 MB.`);
    }
    const user = window.__VP_USER || {};
    const pasta = numeroCotacao != null ? String(numeroCotacao) : 'avulso';
    const salvos = [];
    for (const { tipo, file } of lote) {
      const path = `projetos-elevador/desenhos/${pasta}/${tipo}/${Date.now()}_${uuid().slice(0, 8)}_${file.name.replace(/[^\w.\-]/g, '_')}`;
      const up = await c.storage.from('engenharia').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
      if (up.error) throw new Error(up.error.message);
      const { data: pub } = c.storage.from('engenharia').getPublicUrl(path);
      const { data, error } = await c.from('projetos_elevador_desenhos').insert([{
        referencia: referencia.trim(),
        cliente_nome: (clienteNome || '').trim() || null,
        numero_cotacao: numeroCotacao ?? null,
        formulario_id: formularioId || null, cliente_id: clienteId || null, cliente_documento: clienteDocumento || null,
        tipo_documento: tipo, equipamentos: equips,
        arquivo_nome: file.name, arquivo_path: path, arquivo_url: pub.publicUrl,
        tamanho_bytes: file.size, observacao: observacao || null,
        enviado_por_email: user.email || null, enviado_por_nome: user.nome || user.name || null,
      }]).select().single();
      if (error) {
        await c.storage.from('engenharia').remove([path]).catch(() => {});
        throw new Error(error.message);
      }
      salvos.push(data);
      if (window.VPLog) window.VPLog.registrar({
        modulo: 'Projeto de Elevadores', acao: 'Salvou desenho', alvo: data.referencia, alvo_id: data.id,
        detalhe: { arquivo: data.arquivo_nome, numero_cotacao: data.numero_cotacao, tipo: data.tipo_documento, equipamentos: data.equipamentos },
      });
    }
    return salvos;
  }

  async function excluirDesenho(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const user = window.__VP_USER || {};
    const { data, error } = await c.from('projetos_elevador_desenhos')
      .update({ excluido_em: new Date().toISOString(), excluido_por: user.email || null })
      .eq('id', id).is('excluido_em', null).select('id, referencia, arquivo_nome');
    if (error) throw new Error(error.message);
    if (!data || !data.length) throw new Error('Nada foi excluído (registro inexistente ou sem permissão).');
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Projeto de Elevadores', acao: 'Excluiu desenho', alvo: data[0].referencia, alvo_id: id,
      detalhe: { arquivo: data[0].arquivo_nome },
    });
  }

  window.ProjetoElevadorStore = { listarTodas, listarPorCotacao, salvar, finalizar, uploadAnexo, removerAnexo, uuid,
    listarDesenhos, salvarDesenhos, excluirDesenho, DESENHO_MAX_BYTES, DESENHO_TIPOS,
    buscarObraPorCotacao, buscarClientePorDocumento, obrasDoCliente };
}());
