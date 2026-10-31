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

  async function enviar({ cotacaoFornecedorId, numeroCotacao, mensagem, anexos, autor, emailFornecedor, cc } = {}) {
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
      const base = (window.location.origin || 'https://hub.vpsistema.com');
      /* Link do portal COM o token da cotação do fornecedor (sem ele o portal mostra "cotação não encontrada" — auditoria de
         11/10). Mesmo formato do RFQ (CotacaoElevadorFornecedorStore.cotacaoUrl). Falha ao ler o token → só avisa, sem link. */
      let portalUrl = null;
      try {
        const { data: cf } = await c.from('cotacoes_elevador_fornecedor').select('token').eq('id', cotacaoFornecedorId).maybeSingle();
        if (cf && cf.token) portalUrl = `${base}/cotacao-elevador-fornecedor/${encodeURIComponent(cf.token)}`;
      } catch (e) { console.warn('[Tratativas] token do portal não lido', e); }
      const linksAnexos = (anexos || []).map((a) => `- ${a.nome}: ${a.url}`).join('\n');
      const texto = `Você recebeu uma nova mensagem sobre a cotação${numeroCotacao ? ' Nº ' + numeroCotacao : ''}.\n\n`
        + `${nome}:\n${mensagem?.trim() || '(Sem texto, apenas anexos)'}\n`
        + (linksAnexos ? `\nAnexos:\n${linksAnexos}\n` : '')
        + `\nVocê pode responder diretamente este e-mail.` + (portalUrl ? `\nPortal da cotação: ${portalUrl}` : '');
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
            cc: window.EmailEnvioHelper ? window.EmailEnvioHelper.normalizarLista(cc) : undefined,
            subject: `Nova mensagem - Cotacao No ${numeroCotacao || ''} - VerticalParts`,
            text: texto,
            html: `<p>Você recebeu uma nova mensagem sobre a cotação${numeroCotacao ? ' Nº ' + numeroCotacao : ''}.</p>`
              + `<p><strong>${nome}:</strong></p><p>${(mensagem?.trim() || '(Sem texto, apenas anexos)').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br/>')}</p>`
              + ((anexos || []).length ? '<p>Anexos:<br/>' + anexos.map((a) => `<a href="${a.url}">${a.nome}</a>`).join('<br/>') + '</p>' : '')
              + `<p>Você pode responder diretamente este e-mail.</p>` + (portalUrl ? `<p><a href="${portalUrl}">Ver cotação no portal</a></p>` : ''),
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

  /* 07/10 — HISTÓRICO INTERNO da cotação a fornecedor (mudanças de preço + decisões + eventos).
     Reúne, SÓ LENDO, o que o resto do sistema já grava e mostra na mesma linha do tempo das Tratativas:
       • vp_logs (alvo_id = esta cotação): "Preço do fornecedor atualizado/informado" (de → para, ver
         CotacaoElevadorFornecedorStore.registrarMudancaPreco), registro de resposta por e-mail, exclusão…;
       • eventos_fluxo (alvo_id = esta cotação): envio ao fornecedor, resposta, compra iniciada/confirmada, com QUEM fez;
       • eventos_fluxo do Nº da cotação só do tipo decisão/aval/compra/precificação (Financeiro/Jurídico/CEO) —
         exceto os de OUTRAS cotações a fornecedor do mesmo Nº (label "… · VPEL-…"), pra não misturar fornecedores;
       • decisoes_gerenciais "compra do equipamento (CEO)" do Nº: pedida e decidida (quem, quando, motivo).
     Cada item sai normalizado: { k, quando, quem, titulo, detalhe?, tipo: 'preco'|'decisao'|'evento'|'log', linhas? }. */
  const TIPO_DECISAO_LABEL = { compra_equipamento_ceo: 'Compra do equipamento (aprovação do CEO)' };
  const EVENTO_INTERNO_RE = /aval|decid|compra|precifica|boleto|score|aprov|venda/i;
  function moneyTxt(v, moeda) {
    const n = Number(v); if (!isFinite(n)) return String(v);
    const m = { USD: 'US$', BRL: 'R$', EUR: '€', RMB: 'RMB', CNY: 'CN¥' }[moeda] || moeda || '';
    return (m ? m + ' ' : '') + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  async function listarHistoricoInterno({ cotacaoFornecedorId, numeroCotacao } = {}) {
    const c = sb(); if (!c || !cotacaoFornecedorId) return [];
    const itens = [];
    const seguro = async (fn) => { try { return (await fn()) || []; } catch (e) { console.warn('[Tratativas] histórico interno', e); return []; } };
    const [logs, evDireto, evNumero, decisoes] = await Promise.all([
      seguro(async () => (await c.from('vp_logs').select('id, ator_nome, modulo, acao, detalhe, criado_em').eq('alvo_id', String(cotacaoFornecedorId)).order('criado_em', { ascending: true }).limit(200)).data),
      seguro(async () => (await c.from('eventos_fluxo').select('id, evento, ator_nome, alvo_label, alvo_id, created_at').eq('alvo_id', String(cotacaoFornecedorId)).order('created_at', { ascending: true }).limit(200)).data),
      seguro(async () => numeroCotacao == null ? [] : (await c.from('eventos_fluxo').select('id, evento, ator_nome, alvo_label, alvo_id, created_at').eq('numero_cotacao', Number(numeroCotacao)).order('created_at', { ascending: true }).limit(300)).data),
      seguro(async () => numeroCotacao == null ? [] : (await c.from('decisoes_gerenciais').select('id, tipo, status, decidido_por, decidido_em, motivo, criado_em, solicitado_por').eq('numero_cotacao', Number(numeroCotacao)).limit(100)).data),
    ]);
    logs.forEach((l) => {
      if (/^respondeu a cotação de fornecedor/i.test(l.acao || '')) return;   // já aparece como evento "Fornecedor respondeu"
      const d = l.detalhe || {};
      const linhas = Array.isArray(d.itens) ? d.itens.map((i) => `${i.nome}: ${i.antes == null ? '—' : moneyTxt(i.antes, d.moeda)} → ${i.depois == null ? '—' : moneyTxt(i.depois, d.moeda)}`) : null;
      itens.push({ k: 'log:' + l.id, quando: l.criado_em, quem: l.ator_nome || null, titulo: l.acao, tipo: linhas ? 'preco' : 'log', linhas });
    });
    const direto = new Set();
    evDireto.forEach((e) => { direto.add(e.id); itens.push({ k: 'evf:' + e.id, quando: e.created_at, quem: e.ator_nome || null, titulo: e.evento, tipo: 'evento' }); });
    evNumero.forEach((e) => {
      if (direto.has(e.id)) return;
      if (!EVENTO_INTERNO_RE.test(e.evento || '')) return;
      if (/·\s*VPE[A-Z]-/i.test(e.alvo_label || '') && e.alvo_id !== String(cotacaoFornecedorId)) return;   // outro fornecedor do mesmo Nº
      itens.push({ k: 'evn:' + e.id, quando: e.created_at, quem: e.ator_nome || null, titulo: e.evento, tipo: 'decisao' });
    });
    decisoes.forEach((d) => {
      const nome = TIPO_DECISAO_LABEL[d.tipo]; if (!nome) return;
      if (d.criado_em) itens.push({ k: 'dec:' + d.id + ':c', quando: d.criado_em, quem: d.solicitado_por || null, titulo: 'Decisão pedida — ' + nome, tipo: 'decisao' });
      if (d.decidido_em && d.status && d.status !== 'pendente' && d.status !== 'bloqueada') {
        itens.push({ k: 'dec:' + d.id + ':d', quando: d.decidido_em, quem: d.decidido_por || null, titulo: `Decisão ${d.status} — ${nome}`, detalhe: d.motivo || null, tipo: 'decisao' });
      }
    });
    return itens.filter((i) => i.quando);
  }

  async function uploadAnexo(cotacaoFornecedorId, file) {
    const c = sb(); if (!c) throw new Error('Sem conexão com o banco.');
    const path = `${cotacaoFornecedorId}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
    const { error } = await c.storage.from('tratativas').upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    const { data } = c.storage.from('tratativas').getPublicUrl(path);
    return { nome: file.name, url: data.publicUrl, tipo: file.type, tamanho: file.size, path };
  }

  /* 20/10 — abas "Imagens" e "Documentos" da cotação a fornecedor: TUDO o que o FORNECEDOR mandou, só lendo.
       1) anexos do formulário do link (cotacoes_elevador_fornecedor_anexos, bucket privado cotacao-fornecedor-anexos);
       2) anexos dos e-mails de ENTRADA ligados a esta cotação — mesma regra de listarEmails (referencia_id, ou Nº da
          cotação só com 1 fornecedor e remetente contato do RFQ). E-mail de entrada vindo de dentro da casa
          (@verticalparts.com.br / @vpsistema.com — ex.: alguém respondendo em cópia) NÃO conta como do fornecedor.
     Os anexos dos e-mails já foram guardados pelo read-inbox no bucket emails-anexos; o link é assinado pela Edge
     Function sign-email-anexos (a mesma que o Inbox usa). Nada é copiado nem gravado.
     Devolve [{ id, nome, tipo, tamanho, quando, origem, remetente, assunto, emailId, url }] (separar/agrupar = CfArquivosCalc). */
  const DOMINIO_INTERNO_RE = /@(verticalparts\.com\.br|vpsistema\.com)\s*$/i;
  async function listarArquivosFornecedor({ cotacaoFornecedorId, numeroCotacao, formularioId } = {}) {
    const c = sb(); if (!c || !cotacaoFornecedorId) return [];
    const out = [];
    const cef = window.CotacaoElevadorFornecedorStore;
    try {
      const portal = cef && cef.listarAnexosResposta ? await cef.listarAnexosResposta(cotacaoFornecedorId) : [];
      const urls = await Promise.all((portal || []).map((a) => (a.path && cef.urlAssinadaAnexoResposta) ? cef.urlAssinadaAnexoResposta(a.path, 3600).catch(() => null) : null));
      (portal || []).forEach((a, i) => out.push({
        id: 'f:' + a.id, nome: a.nome_arquivo, tipo: a.tipo_arquivo, tamanho: a.tamanho_bytes, quando: a.created_at,
        origem: 'formulario', remetente: null, assunto: 'Formulário do link (resposta do fornecedor)', emailId: null, url: urls[i] || null,
      }));
    } catch (e) { console.warn('[Arquivos do fornecedor] anexos do formulário', e); }

    try {
      const emails = (await listarEmails({ cotacaoFornecedorId, numeroCotacao, formularioId }))
        .filter((e) => e.direcao === 'entrada' && !DOMINIO_INTERNO_RE.test(String(e.de_email || '')));
      const ids = emails.map((e) => e.id);
      if (ids.length) {
        const { data: comAnexos, error } = await c.from('emails_projeto').select('id, anexos').in('id', ids);
        if (error) throw error;
        const anexosPor = new Map((comAnexos || []).map((r) => [r.id, Array.isArray(r.anexos) ? r.anexos : []]));
        const itens = [];
        emails.forEach((e) => (anexosPor.get(e.id) || []).forEach((a, i) => {
          if (!a || !a.path) return;
          itens.push({
            id: 'e:' + e.id + ':' + i, nome: a.filename || String(a.path).split('/').pop(), tipo: a.content_type, tamanho: a.size,
            quando: e.data_mensagem, origem: 'email', remetente: e.de_email, assunto: e.assunto, emailId: e.id, path: a.path, url: null,
          });
        }));
        const paths = [...new Set(itens.map((x) => x.path))];
        const urls = {};
        for (let i = 0; i < paths.length; i += 100) {
          try {
            const { data: sg, error: e2 } = await c.functions.invoke('sign-email-anexos', { body: { paths: paths.slice(i, i + 100) } });
            if (!e2 && sg && sg.urls) Object.assign(urls, sg.urls);
          } catch (_) { /* sem link: o arquivo aparece, mas sem abrir */ }
        }
        itens.forEach((x) => { x.url = urls[x.path] || null; delete x.path; out.push(x); });
      }
    } catch (e) { console.warn('[Arquivos do fornecedor] anexos dos e-mails', e); }
    return out;
  }

  window.TratativasStore = { listarPorCotacao, listarEmails, listarHistoricoInterno, listarArquivosFornecedor, enviar, uploadAnexo };
}());
