/* ============================================================
   tratativas-store.js
   Histórico de conversa/negociação de uma Cotação a Fornecedor —
   substitui o vaivém de e-mail: um thread único por cotação,
   correlacionado pelo Nº da Cotação, com anexo (bucket `tratativas`).
   Tabela: tratativas_cotacao. window.TratativasStore.
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  /* Mesmo critério de identidade do VPLog: SSO real > rótulo do setor. */
  function autorAtual() {
    let r = 'admin';
    try { r = JSON.parse(localStorage.getItem('vpprd.role')) || 'admin'; } catch (e) {}
    let u = window.__VP_USER;
    if (!u) { try { u = JSON.parse(sessionStorage.getItem('vpprd_user')); } catch (e) {} }
    const nomes = { comercial: 'Comercial', engenharia: 'Engenharia', financeiro: 'Financeiro', importacao: 'Importação', admin: 'Admin' };
    return (u && u.nome) || nomes[r] || r;
  }

  async function listarPorCotacao(cotacaoFornecedorId) {
    const c = sb(); if (!c || !cotacaoFornecedorId) return [];
    const { data, error } = await c.from('tratativas_cotacao')
      .select('*').eq('cotacao_fornecedor_id', cotacaoFornecedorId).order('created_at', { ascending: true });
    if (error) { console.warn('[Tratativas] listarPorCotacao falhou', error); return []; }
    return data || [];
  }

  /* 07/10 — contato do fornecedor: primeiro o que foi usado de verdade no RFQ desta
     cotação (cotacoes_elevador_fornecedor.recipient.email, pode ter vários separados
     por vírgula); só se não houver, o cadastro (Cadastros → Fornecedores) casando por
     APROXIMAÇÃO (a cotação diz "Glarie", o cadastro "GLARIE ELEVATOR CO.,LTD" — a
     busca antiga por igualdade exata nunca achava ninguém e o aviso saía sem destino). */
  function splitEmails(txt) {
    return String(txt || '').split(/[,;\s]+/).map((e) => e.trim()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  }
  async function contatoDoFornecedor(c, cotacaoFornecedorId) {
    const { data: cot } = await c.from('cotacoes_elevador_fornecedor')
      .select('fornecedor, recipient').eq('id', cotacaoFornecedorId).maybeSingle();
    const doRfq = splitEmails(cot && cot.recipient && cot.recipient.email);
    if (doRfq.length) return doRfq;
    const nome = String((cot && cot.fornecedor) || '').trim();
    if (!nome) return [];
    const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const alvo = norm(nome);
    const { data: lista } = await c.from('fornecedores').select('razao_social, nome_fantasia, email').not('email', 'is', null).limit(2000);
    const achado = (lista || []).find((f) => {
      const a = norm(f.nome_fantasia), b = norm(f.razao_social);
      return (a && (a.includes(alvo) || alvo.includes(a))) || (b && (b.includes(alvo) || alvo.includes(b)));
    });
    return splitEmails(achado && achado.email);
  }

  async function enviar({ cotacaoFornecedorId, numeroCotacao, mensagem, anexos, autor, emailFornecedor } = {}) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    if (!cotacaoFornecedorId) throw new Error('Cotação a fornecedor não informada.');
    if (!mensagem?.trim() && !(anexos || []).length) throw new Error('Escreva uma mensagem ou anexe um arquivo.');

    // Salvar mensagem no banco (o histórico existe mesmo se o e-mail falhar)
    const { data, error } = await c.from('tratativas_cotacao').insert({
      cotacao_fornecedor_id: cotacaoFornecedorId,
      numero_cotacao: numeroCotacao ?? null,
      autor: autor || autorAtual(),
      mensagem: mensagem?.trim() || null,
      anexos: anexos || [],
    }).select().single();
    if (error) throw new Error(error.message);

    let destinos = splitEmails(emailFornecedor);
    if (!destinos.length) {
      try { destinos = await contatoDoFornecedor(c, cotacaoFornecedorId); }
      catch (e) { console.warn('[Tratativas] erro ao buscar e-mail do fornecedor', e); }
    }

    /* Resultado do aviso por e-mail, devolvido junto da mensagem: { ok, para, motivo }.
       Antes a falha era só console.warn — a tela nunca dizia se o fornecedor foi avisado. */
    let aviso = { ok: false, para: [], motivo: 'Nenhum e-mail do fornecedor encontrado (RFQ ou cadastro).' };
    if (destinos.length) {
      const nome = autor || autorAtual();
      const base = (window.location.origin || 'https://vpgestaoimportacao.vpsistema.com');
      const linksAnexos = (anexos || []).map((a) => `- ${a.nome}: ${a.url}`).join('\n');
      const texto = `Você recebeu uma nova mensagem sobre a cotação${numeroCotacao ? ' Nº ' + numeroCotacao : ''}.\n\n`
        + `${nome}:\n${mensagem?.trim() || '(Sem texto, apenas anexos)'}\n`
        + (linksAnexos ? `\nAnexos:\n${linksAnexos}\n` : '')
        + `\nVocê pode responder diretamente este e-mail.\nPortal da cotação: ${base}/cotacao-elevador-fornecedor`;
      try {
        /* ATENÇÃO — o corpo precisa ir em `body:`. A versão anterior passava {to, subject, html}
           direto como 2º argumento do invoke (sem `body`), então o send-email recebia um corpo
           VAZIO e recusava (400) em silêncio: nenhum aviso de Tratativa chegou a sair.
           Assunto no padrão "Cotação Nº N" (regex 'provável' do read-inbox); referenciaTipo/
           referenciaId ligam o e-mail à MESMA cotação a fornecedor do RFQ (vínculo 'certo'
           por Message-ID quando o fornecedor responde, e a Tratativa lê de volta por aí). */
        const { data: r, error: emailError } = await c.functions.invoke('send-email', {
          body: {
            to: destinos.join(', '),
            subject: `Nova mensagem — Cotação Nº ${numeroCotacao || ''} — VerticalParts`,
            text: texto,
            html: `<p>Você recebeu uma nova mensagem sobre a cotação${numeroCotacao ? ' Nº ' + numeroCotacao : ''}.</p>`
              + `<p><strong>${nome}:</strong></p><p>${(mensagem?.trim() || '(Sem texto, apenas anexos)').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</p>`
              + ((anexos || []).length ? '<p>Anexos:<br/>' + anexos.map((a) => `<a href="${a.url}">${a.nome}</a>`).join('<br/>') + '</p>' : '')
              + `<p>Você pode responder diretamente este e-mail.</p><p><a href="${base}/cotacao-elevador-fornecedor">Ver cotação no portal</a></p>`,
            numeroCotacao: numeroCotacao ?? undefined,
            referenciaTipo: 'tratativa_cotacao',
            referenciaId: cotacaoFornecedorId,
          },
        });
        if (!emailError && r && r.ok) {
          aviso = { ok: true, para: destinos, motivo: null };
          if (r.avisoPersistencia) aviso.persistencia = r.avisoPersistencia;
        } else {
          let motivo = (r && r.error) || (emailError && emailError.message) || 'send-email recusou o envio.';
          try { if (emailError && emailError.context && emailError.context.json) { const j = await emailError.context.json(); if (j && j.error) motivo = j.error; } } catch (e) {}
          aviso = { ok: false, para: destinos, motivo };
          console.warn('[Tratativas] send-email falhou', emailError, r);
        }
      } catch (e) {
        aviso = { ok: false, para: destinos, motivo: e.message || String(e) };
        console.warn('[Tratativas] erro ao invocar send-email', e);
      }
    }

    return { ...data, __email: aviso };
  }

  /* 07/10 — MÃO DUPLA com o Inbox (Geral → Inbox, tabela emails_projeto).
     Tudo o que está ligado a ESTA cotação a fornecedor aparece na linha do tempo das Tratativas:
       1) e-mails com referencia_id = esta cotação (RFQ enviado, avisos de Tratativa, respostas do
          fornecedor — o read-inbox herda a referência quando a resposta preserva o Message-ID — e
          respostas dadas pelo Inbox a esses e-mails);
       2) e-mails só com o Nº da cotação (vínculo 'provável'/avulso, sem referencia_id) — SÓ quando
          esta é a única cotação a fornecedor do formulário (com 2+ fornecedores o Nº não diz de qual
          é) E o outro lado do e-mail é um contato desta cotação (assim um e-mail ao CLIENTE da
          mesma cotação nunca cai aqui).
     O aviso "Nova mensagem —" que a própria Tratativa dispara não é repetido: ele já é a mensagem. */
  const EMAIL_COLS = 'id, direcao, assunto, de_email, de_nome, para, corpo_texto, data_mensagem, referencia_tipo, referencia_id, numero_cotacao, vinculo_confianca';
  function paraLista(p) { return Array.isArray(p) ? p : (p ? [String(p)] : []); }
  function emailsDe(txt) { return (String(txt || '').toLowerCase().match(/[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']+/g) || []); }

  async function listarEmails({ cotacaoFornecedorId, numeroCotacao, formularioId } = {}) {
    const c = sb(); if (!c || !cotacaoFornecedorId) return [];
    const out = new Map();
    try {
      const { data: porRef } = await c.from('emails_projeto').select(EMAIL_COLS)
        .eq('referencia_id', String(cotacaoFornecedorId)).is('excluido_em', null).order('data_mensagem', { ascending: true }).limit(300);
      (porRef || []).forEach((e) => out.set(e.id, e));

      if (numeroCotacao != null && formularioId) {
        const { data: irmas } = await c.from('cotacoes_elevador_fornecedor').select('id, recipient')
          .eq('formulario_elevador_id', formularioId).is('excluido_em', null);
        const minha = (irmas || []).find((i) => i.id === cotacaoFornecedorId);
        if ((irmas || []).length === 1 && minha) {
          const contatos = new Set(emailsDe(minha.recipient && minha.recipient.email));
          if (contatos.size) {
            const { data: porNum } = await c.from('emails_projeto').select(EMAIL_COLS)
              .eq('numero_cotacao', Number(numeroCotacao)).is('referencia_id', null).is('excluido_em', null)
              .order('data_mensagem', { ascending: true }).limit(300);
            (porNum || []).forEach((e) => {
              const outros = e.direcao === 'saida' ? paraLista(e.para).flatMap(emailsDe) : emailsDe(e.de_email);
              if (outros.some((x) => contatos.has(x))) out.set(e.id, e);
            });
          }
        }
      }
    } catch (e) { console.warn('[Tratativas] listarEmails falhou', e); }
    return [...out.values()]
      .filter((e) => !(e.direcao === 'saida' && e.referencia_tipo === 'tratativa_cotacao' && /^Nova mensagem\s+[—-]/i.test(e.assunto || '')))
      .sort((a, b) => new Date(a.data_mensagem || 0) - new Date(b.data_mensagem || 0));
  }

  async function uploadAnexo(cotacaoFornecedorId, file) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    const path = `${cotacaoFornecedorId}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
    const { error } = await c.storage.from('tratativas').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = c.storage.from('tratativas').getPublicUrl(path);
    return { nome: file.name, url: data.publicUrl, tipo: file.type, tamanho: file.size, path };
  }

  window.TratativasStore = { listarPorCotacao, listarEmails, enviar, uploadAnexo };
}());
