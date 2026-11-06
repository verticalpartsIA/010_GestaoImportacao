/* ============================================================
   proposta-conferir-calc.js — "Conferir proposta": checagens EXATAS (código,
   sem IA) sobre o que está digitado no editor, antes do envio.
   Especificação: docs/modulos/04_comercial_pre_venda.md 4.5.10 item 13.

   - Só LÊ e aponta: nunca altera campo, valor, parcela ou status.
   - Cada achado: { id, gravidade: 'impede'|'atencao'|'sugestao', secao (id da
     seção do editor), titulo, detalhe, falta?: true }.
     `falta` marca dado que simplesmente não foi preenchido (alimenta a lista
     "O que falta para enviar").
   - A conferência NÃO bloqueia o envio: o único bloqueio continua sendo o gate
     de envio que já existe. "impede" = achado grave (pede confirmação extra).

   window.PropostaConferir
   ============================================================ */
(function () {
  'use strict';

  function num(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    return parseFloat((v ?? '0').toString().replace(/\./g, '').replace(',', '.')) || 0;
  }
  const brl = (n) => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const vazio = (v) => !String(v == null ? '' : v).trim();
  const digitos = (v) => String(v == null ? '' : v).replace(/\D/g, '');
  const pareceEmail = (v) => /\S+@\S+/.test(String(v || ''));
  const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

  /* data = o objeto do editor; eq = 'elevador'|'escada'|'esteira';
     ctx = { opcoes (PropostaOpcoes), travada, temContrato } (tudo opcional). */
  function conferir(data, eq, ctx) {
    ctx = ctx || {};
    const d = data || {};
    const O = ctx.opcoes || (typeof window !== 'undefined' ? window.PropostaOpcoes : null);
    const a = [];
    const add = (id, gravidade, secao, titulo, detalhe, extra) => a.push({ id, gravidade, secao, titulo, detalhe, ...(extra || {}) });
    const cli = d.cliente || {};
    const ven = d.vendedor || {};
    const bloco = d[eq] || {};
    const v = bloco.valores || {};

    /* ---- cliente e vendedor ---- */
    if (vazio(cli.nome)) add('cliente-nome', 'impede', 'cliente', 'Cliente sem nome', 'A proposta precisa do nome do cliente para ser salva e enviada.', { falta: true });
    if (vazio(cli.cnpj)) add('cliente-doc', 'atencao', 'cliente', 'Cliente sem CNPJ/CPF', 'Sem o documento o contrato e a consulta ao Omie ficam sem base.', { falta: true });
    else if (![11, 14].includes(digitos(cli.cnpj).length)) add('cliente-doc-tam', 'atencao', 'cliente', 'CNPJ/CPF com tamanho estranho', `O documento tem ${digitos(cli.cnpj).length} dígitos (CPF tem 11, CNPJ tem 14).`);
    if (!vazio(cli.email) && !emailValido(cli.email)) add('cliente-email', 'atencao', 'cliente', 'E-mail do cliente inválido', 'Confira o formato (nome@empresa.com.br).');
    if (pareceEmail(cli.telefone)) add('cliente-tel-email', 'atencao', 'cliente', 'E-mail no campo de telefone', 'Parece que um e-mail foi colado no campo Telefone do cliente.');
    if (vazio(ven.celular)) add('vendedor-celular', 'atencao', 'proposta', 'Vendedor sem celular/WhatsApp', 'O cliente precisa de um contato direto na capa da proposta.', { falta: true });
    else if (pareceEmail(ven.celular)) add('vendedor-cel-email', 'atencao', 'proposta', 'E-mail no campo de celular do vendedor', 'Parece que um e-mail foi colado no campo Celular / WhatsApp.');
    if (vazio(ven.email)) add('vendedor-email', 'sugestao', 'proposta', 'Vendedor sem e-mail', 'Aparece na capa da proposta.', { falta: true });

    /* ---- texto ---- */
    if (vazio(bloco.textoProposta)) add('texto-vazio', 'atencao', 'texto', 'Texto da proposta vazio', 'Preencha o texto de abertura que o cliente lê primeiro.', { falta: true });

    /* ---- equipamentos e valores ---- */
    const itens = Array.isArray(v.itens) ? v.itens : [];
    if (O && O.semEquipamentoVisivel && itens.length && O.semEquipamentoVisivel(d, eq)) {
      add('todos-ocultos', 'impede', 'valores', 'Todos os equipamentos estão ocultos', 'Reexiba pelo menos um equipamento: não é possível publicar nem enviar.');
    }
    if (itens.length) {
      itens.filter((it) => !(num(it.valorUnit) > 0)).forEach((it) => {
        add('item-zero-' + (it.id || it.equipamento), 'impede', 'valores', `Equipamento sem valor: ${it.id || it.equipamento || '—'}`, 'O valor está zerado. Use "Herdar dados" (traz da Precificação) ou peça a Precificação ao Financeiro.');
      });
    } else if (!(num(v.valorUnit) > 0)) {
      add('valor-zero', 'impede', 'valores', 'Proposta sem valor', 'Nenhum valor foi informado nem herdado da Precificação.', { falta: true });
    }

    /* ---- pagamento ---- */
    const total = O && O.totalOficial ? O.totalOficial(d, eq) : 0;
    const parcelas = Array.isArray(v.parcelas) ? v.parcelas : [];
    if (vazio(v.formaTipo)) add('forma-vazia', 'atencao', 'valores', 'Forma de pagamento não escolhida', 'Escolha À vista ou Parcelado.', { falta: true });
    if (v.formaTipo === 'parcelado' && !parcelas.length) add('parcelas-vazias', 'impede', 'valores', 'Pagamento parcelado sem parcelas', 'Defina a quantidade de parcelas ou use "Recalcular".');
    if (parcelas.length && total > 0) {
      const soma = parcelas.reduce((s, p) => s + num(p.valor), 0);
      if (Math.abs(total - soma) >= 0.01) {
        add('parcelas-soma', 'impede', 'valores', 'Parcelas não somam o total', `As parcelas somam ${brl(soma)} e o total da proposta é ${brl(total)} (diferença de ${brl(total - soma)}). Use "Recalcular".`);
      }
    }

    /* ---- pedidos abertos ---- */
    const comAumento = itens.filter((it) => it && it.aumentoPendente);
    if (d.aumentoPendente || comAumento.length) {
      add('aumento-aberto', 'atencao', 'valores', 'Pedido de aumento de valor aguardando o Financeiro', 'O valor pode mudar quando a Precificação for atualizada; depois clique em Herdar dados.');
    }
    if (itens.some((it) => it && it.descontoPendente)) {
      add('desconto-aberto', 'atencao', 'valores', 'Pedido de desconto aguardando aprovação', 'Aguarde a decisão do Gestor ou do CEO antes de enviar.');
    }

    /* ---- especificações ---- */
    const esp = Array.isArray(bloco.especificacoes) ? bloco.especificacoes : [];
    if (eq === 'elevador' && !esp.some((e) => e && (!vazio(e.modelo) || !vazio(e.id)))) {
      add('espec-vazia', 'atencao', 'espec', 'Sem especificações técnicas', 'Nenhum equipamento descrito. Use "Herdar dados" para trazer do Formulário.', { falta: true });
    }

    /* ---- perfis por tipo: texto de passageiro em carga ---- */
    (Array.isArray(bloco.perfis) ? bloco.perfis : []).forEach((p) => {
      if (!p || String(p.tipo || '').toLowerCase().indexOf('carga') < 0) return;
      const texto = [p.textoModelos, ...(p.beneficios || []), ...(p.diferenciais || [])].join(' ');
      if (/passageiros?/i.test(texto)) {
        add('perfil-tipo-' + (p.id || p.nome), 'sugestao', 'acabamentos', `Texto de passageiro em equipamento de carga (${p.nome || 'perfil'})`, 'O texto cita passageiros; confira se cabe em elevador de carga.');
      }
    });

    /* ---- estado da proposta ---- */
    if (ctx.temContrato) {
      add('contrato-existe', 'atencao', 'valores', 'Já existe contrato desta proposta', 'Se o valor ou o conteúdo mudou, o Jurídico precisa refazer o contrato.');
    }
    if (ctx.travada) {
      add('travada', 'sugestao', 'proposta', 'Proposta travada', 'Já foi enviada ao cliente; para editar peça o destrave ao Líder.');
    }

    const ordem = { impede: 0, atencao: 1, sugestao: 2 };
    a.sort((x, y) => ordem[x.gravidade] - ordem[y.gravidade]);
    return a;
  }

  /* Lista "O que falta para enviar": dado não preenchido + achados graves. */
  function faltaParaEnviar(achados) {
    return (achados || []).filter((x) => x.falta || x.gravidade === 'impede');
  }

  function resumo(achados) {
    const c = { impede: 0, atencao: 0, sugestao: 0 };
    (achados || []).forEach((x) => { c[x.gravidade] += 1; });
    return c;
  }

  window.PropostaConferir = { conferir, faltaParaEnviar, resumo, num };
}());
