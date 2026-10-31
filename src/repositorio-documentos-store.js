/* ============================================================
   repositorio-documentos-store.js — Entrega & Documentação › Repositório
   Documentos. Upload genérico: qualquer documento que a Engenharia ache
   necessário guardar aqui — sem vínculo com cliente/obra/cotação, sem
   restrição de tipo de arquivo. Arquivo no bucket Storage `engenharia`
   (já existente — não criar bucket novo), path
   repositorio-documentos/{timestamp}_{uuid8}_{nome}. Metadados em
   `repositorio_documentos`. Exclusão = soft-delete (excluido_em/excluido_por),
   mesmo padrão de Contratos Social/Projeto de Elevadores Desenhos.
   ============================================================ */

window.RepositorioDocumentosStore = (() => {
  const MAX_BYTES = 25 * 1024 * 1024;
  const sb = () => window.__VP_SB && window.__VP_SB.sb;

  function uid8() {
    return Math.random().toString(16).slice(2, 10);
  }

  async function listar() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('repositorio_documentos').select('*')
      .is('excluido_em', null).order('criado_em', { ascending: false }).limit(1000);
    if (error) throw new Error(error.message);
    return data || [];
  }

  /* Sobe o arquivo (qualquer tipo) e grava o registro. */
  async function salvar({ file, titulo, descricao }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!file) throw new Error('Selecione o arquivo.');
    if (file.size > MAX_BYTES) throw new Error('Arquivo acima de 25 MB.');

    const user = window.__VP_USER || {};
    const path = `repositorio-documentos/${Date.now()}_${uid8()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
    const up = await c.storage.from('engenharia').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = c.storage.from('engenharia').getPublicUrl(path);

    const { data, error } = await c.from('repositorio_documentos').insert([{
      titulo: (titulo || '').trim() || file.name,
      descricao: (descricao || '').trim() || null,
      arquivo_nome: file.name,
      arquivo_path: path,
      arquivo_url: pub.publicUrl,
      tamanho_bytes: file.size,
      enviado_por_email: user.email || null,
      enviado_por_nome: user.nome || user.name || null,
    }]).select().single();
    if (error) {
      // não deixa arquivo órfão no Storage se a gravação falhou
      await c.storage.from('engenharia').remove([path]).catch(() => {});
      throw new Error(error.message);
    }
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Repositório Documentos', acao: 'Salvou documento',
      alvo: data.titulo, alvo_id: data.id,
      detalhe: { arquivo: data.arquivo_nome },
    });
    return data;
  }

  async function excluir(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const user = window.__VP_USER || {};
    const { data, error } = await c.from('repositorio_documentos')
      .update({ excluido_em: new Date().toISOString(), excluido_por: user.email || null })
      .eq('id', id).is('excluido_em', null).select('id, titulo, arquivo_nome');
    if (error) throw new Error(error.message);
    if (!data || !data.length) throw new Error('Nada foi excluído (registro inexistente ou sem permissão).');
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Repositório Documentos', acao: 'Excluiu documento',
      alvo: data[0].titulo, alvo_id: id, detalhe: { arquivo: data[0].arquivo_nome },
    });
  }

  return { MAX_BYTES, listar, salvar, excluir };
})();
