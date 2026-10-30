/* ============================================================
   obra-art-store.js — Obras & Instalação › ART (uma ART por OBRA).
   Fluxo: Gustavo anexa modelo + boleto -> Juliana marca "paga" -> Gustavo anexa
   a definitiva -> Felipe marca "enviada à obra". Cada passo avisa a próxima
   pessoa por WhatsApp (linha em `alertas`, entregue pelo gi-avisos).
   A linha nasce no banco (gatilho da 1ª assinatura do Contrato do Instalador).
   Arquivos no bucket `engenharia` (pasta art/<obra>/<tipo>/). Pagamento só com
   a ação 'confirmar_pagamento' — conferido também no banco.
   ============================================================ */
window.ObraArtStore = (() => {
  const MAX_BYTES = 25 * 1024 * 1024;
  const GUSTAVO = 'gustavo@escamax.com.br';
  const JULIANA = 'juliana@verticalparts.com.br';
  const FELIPE = 'felipe.barros@verticalparts.com.br';
  const sb = () => window.__VP_SB && window.__VP_SB.sb;
  const quem = () => (window.__VP_USER && window.__VP_USER.email) || null;
  const uid8 = () => Math.random().toString(16).slice(2, 10);

  async function listar() {
    const c = sb(); if (!c) return [];
    const { data, error } = await c.from('obra_art').select('*').order('criado_em', { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    return data || [];
  }

  async function avisar(email, etapa, art, sub) {
    try {
      await sb().from('alertas').upsert([{
        id: `art-${etapa}-${art.codigo_obra}`, level: 'info', module: 'Engenharia', rota: '/engenharia/art',
        title: `ART da obra ${art.codigo_obra} — ${art.cliente_nome || 'cliente'}: ${etapa === 'boleto' ? 'boleto para pagar' : etapa === 'paga' ? 'paga, emitir a definitiva' : 'definitiva pronta'}`,
        sub, resolved: false, destinatario_email: email,
      }], { onConflict: 'id', ignoreDuplicates: true });
    } catch (e) { console.warn('[ObraArt] aviso não gravado', e); }
  }

  async function atualizar(art, patch, acao) {
    const { data, error } = await sb().from('obra_art').update(patch).eq('codigo_obra', art.codigo_obra).select().single();
    if (error) throw new Error(error.message);
    if (window.VPLog) window.VPLog.registrar({ modulo: 'ART', acao, alvo: art.codigo_obra, alvo_id: art.codigo_obra, detalhe: { cliente: art.cliente_nome } });
    return data;
  }

  /* campo: 'modelo' | 'boleto' | 'definitiva' */
  async function anexar(art, campo, file) {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    if (!file) throw new Error('Selecione o arquivo.');
    if (file.size > MAX_BYTES) throw new Error('Arquivo acima de 25 MB.');
    if (campo === 'definitiva' && !['paga', 'definitiva_anexada'].includes(art.status)) throw new Error('A ART definitiva só entra depois que o boleto for marcado como pago.');
    const path = `art/${art.codigo_obra}/${campo}/${Date.now()}_${uid8()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
    const up = await c.storage.from('engenharia').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' });
    if (up.error) throw new Error(up.error.message);
    const { data: pub } = c.storage.from('engenharia').getPublicUrl(path);
    const arq = { url: pub.publicUrl, nome: file.name, em: new Date().toISOString(), por: quem() };
    const patch = { [campo]: arq };
    const antes = art;
    const depois = { ...art, ...patch };
    if (campo !== 'definitiva' && depois.modelo && depois.boleto && art.status === 'aguardando_modelo') patch.status = 'modelo_anexado';
    if (campo === 'definitiva') patch.status = 'definitiva_anexada';
    let novo;
    try { novo = await atualizar(art, patch, `Anexou ${campo === 'modelo' ? 'o modelo da ART' : campo === 'boleto' ? 'o boleto da ART' : 'a ART definitiva'}`); }
    catch (e) { await c.storage.from('engenharia').remove([path]).catch(() => {}); throw e; }
    if (patch.status === 'modelo_anexado' && antes.status !== 'modelo_anexado') {
      await avisar(JULIANA, 'boleto', novo, `O Gustavo anexou o modelo da ART e o boleto da obra ${novo.codigo_obra}. Pague o boleto e marque como paga em /engenharia/art.`);
    }
    if (campo === 'definitiva') {
      await avisar(FELIPE, 'definitiva', novo, `A ART definitiva da obra ${novo.codigo_obra} está anexada em /engenharia/art. Envie para a obra e marque como enviada.`);
    }
    return novo;
  }

  async function marcarPaga(art) {
    if (art.status !== 'modelo_anexado') throw new Error('Anexe o modelo e o boleto antes de marcar como paga.');
    const novo = await atualizar(art, { status: 'paga', pago_em: new Date().toISOString(), pago_por: quem() }, 'Marcou a ART como paga');
    await avisar(GUSTAVO, 'paga', novo, `O boleto da ART da obra ${novo.codigo_obra} foi pago. Emita a ART definitiva e anexe em /engenharia/art.`);
    return novo;
  }

  async function marcarEnviada(art) {
    if (art.status !== 'definitiva_anexada') throw new Error('A definitiva precisa estar anexada.');
    return atualizar(art, { status: 'enviada', enviada_em: new Date().toISOString(), enviada_por: quem() }, 'Marcou a ART como enviada à obra');
  }

  return { listar, anexar, marcarPaga, marcarEnviada };
})();
