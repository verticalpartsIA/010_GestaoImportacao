/* ============================================================
   contratos-sociais-store.js — Repositório de Contratos Sociais (PDF) por cliente
   Comercial | Pré-venda. PDF vai pro bucket Storage `engenharia`
   (path contratos-sociais/{cliente_id}/...); metadados em `contratos_sociais`.
   Exclusão = soft-delete (excluido_em/excluido_por).
   ============================================================ */

window.ContratosSociaisStore = (() => {
  const MAX_BYTES = 20 * 1024 * 1024;
  const sb = () => window.__VP_SB && window.__VP_SB.sb;

  async function listar() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('contratos_sociais').select('*')
      .is('excluido_em', null).order('criado_em', { ascending: false }).limit(1000);
    if (error) throw new Error(error.message);
    return data || [];
  }

  /* Sobe o PDF e grava o registro. cliente = linha de `clientes`. */
  async function salvar({ cliente, file, observacao }) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!cliente || !cliente.id) throw new Error('Identifique o cliente.');
    if (!file) throw new Error('Selecione o PDF do contrato social.');
    const ehPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!ehPdf) throw new Error('O arquivo precisa ser um PDF.');
    if (file.size > MAX_BYTES) throw new Error('PDF acima de 20 MB.');

    const user = window.__VP_USER || {};
    const path = `contratos-sociais/${cliente.id}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
    const up = await c.storage.from('engenharia').upload(path, file, { upsert: false, contentType: 'application/pdf' });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = c.storage.from('engenharia').getPublicUrl(path);

    const { data, error } = await c.from('contratos_sociais').insert([{
      cliente_id: cliente.id,
      cliente_nome: cliente.razao_social || cliente.nome_fantasia || '—',
      cliente_documento: cliente.cnpj || cliente.cpf || null,
      arquivo_nome: file.name,
      arquivo_path: path,
      arquivo_url: pub.publicUrl,
      tamanho_bytes: file.size,
      observacao: observacao || null,
      enviado_por_email: user.email || null,
      enviado_por_nome: user.nome || user.name || null,
    }]).select().single();
    if (error) {
      // não deixa PDF órfão no Storage se a gravação falhou
      await c.storage.from('engenharia').remove([path]).catch(() => {});
      throw new Error(error.message);
    }
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Contratos Social', acao: 'Salvou contrato social',
      alvo: data.cliente_nome, alvo_id: data.id,
      detalhe: { cliente_id: data.cliente_id, arquivo: data.arquivo_nome },
    });
    return data;
  }

  async function excluir(id) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const user = window.__VP_USER || {};
    const { data, error } = await c.from('contratos_sociais')
      .update({ excluido_em: new Date().toISOString(), excluido_por: user.email || null })
      .eq('id', id).is('excluido_em', null).select('id, cliente_nome, arquivo_nome');
    if (error) throw new Error(error.message);
    if (!data || !data.length) throw new Error('Nada foi excluído (registro inexistente ou sem permissão).');
    if (window.VPLog) window.VPLog.registrar({
      modulo: 'Contratos Social', acao: 'Excluiu contrato social',
      alvo: data[0].cliente_nome, alvo_id: id, detalhe: { arquivo: data[0].arquivo_nome },
    });
  }

  return { MAX_BYTES, listar, salvar, excluir };
})();
