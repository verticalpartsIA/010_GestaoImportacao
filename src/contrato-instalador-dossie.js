/* ============================================================
   contrato-instalador-dossie.js
   Funções PURAS que traduzem um Dossiê (dossier_obra) + o preço combinado
   (instalador_acordos) + o cadastro da empresa instaladora no estado do
   Contrato do Instalador (15/10/2026). Informar o nº do Dossiê no Passo 1
   preenche modalidade/equipamento/obra/instalador/valor/parcelas.
   O que o Dossiê não traz (ex.: distância) continua manual.
   window.CIDossie
   ============================================================ */
(function () {
  'use strict';

  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  /* "Elevador de Passageiros – 600 – 10 – 29,2 – MRL – 1 Porta" → equipamento/capacidade/paradas.
     Escada/Esteira: "Escada Rolante - 35º - 1000mm 4000mm". Formato livre: o que não casar fica vazio. */
  function parseEquipamento(building, equipType) {
    const txt = String(building || '');
    const n = norm(txt + ' ' + (equipType || ''));
    let equipamento = 'elevador';
    if (/escada/.test(n)) equipamento = 'escada';
    else if (/esteira/.test(n)) equipamento = 'esteira';
    const out = { equipamento, capacidadeCarga: '', paradas: '', tipoElevador: '', descricao: txt.trim() };
    if (equipamento === 'elevador') {
      const partes = txt.split(/\s*[–—-]\s*/).map((p) => p.trim());
      const num = (v) => (/^\d+([.,]\d+)?$/.test(v || '') ? v : '');
      out.capacidadeCarga = num(partes[1]);
      out.paradas = num(partes[2]);
      if (/panor/.test(n)) out.tipoElevador = 'panoramico';
      else if (/carga/.test(n)) out.tipoElevador = 'carga';
      else if (/passageiro|social/.test(n)) out.tipoElevador = 'social';
      else out.tipoElevador = 'outros';   // maca/leito, homelift etc.
    }
    return out;
  }

  /* "Rua das Flores, 123 - sala 4" → { rua:'Rua das Flores', numero:'123', complemento:'sala 4' }.
     Sem número reconhecível: tudo em rua. "S/N" vira numero 'S/N'. */
  function splitLogradouro(texto) {
    const t = String(texto || '').trim();
    if (!t) return { rua: '', numero: '', complemento: '' };
    let m = t.match(/^(.*?)[,\s]+(?:n[ºo°.]?\s*)?(\d{1,3}(?:\.\d{3})+|\d+[A-Za-z]?)\s*(?:[-–,/]\s*(.*))?$/i);
    if (m && m[1].trim()) return { rua: m[1].replace(/[,\s-]+$/, '').trim(), numero: m[2].replace(/\./g, ''), complemento: (m[3] || '').trim() };
    m = t.match(/^(.*?)(?:,\s*|\s+)(s\/n|sn|,?\s*sem n[úu]mero)\b\s*(?:[-–,/]\s*(.*))?$/i);
    if (m && m[1].trim()) return { rua: m[1].replace(/[,\s-]+$/, '').trim(), numero: 'S/N', complemento: (m[3] || '').trim() };
    return { rua: t, numero: '', complemento: '' };
  }

  /* Divide em centavos, resto na última (mesma regra do contrato). */
  function dividir(valor, n) {
    const total = Math.round((Number(valor) || 0) * 100);
    const base = Math.floor(total / n);
    const partes = Array(n).fill(base);
    partes[n - 1] += total - base * n;
    return partes.map((c) => c / 100);
  }

  /* Parcelas do acordo → formaPagamento do contrato. 2 e 3 usam os marcos automáticos (início/metade/fim);
     outro número vira personalizado, com N parcelas iguais (a última absorve o centavo). */
  function formaPagamentoDoAcordo(qtd, valor, mask) {
    const n = Number(qtd) || 2;
    if (n === 2 || n === 3) return { formaPagamento: String(n), parcelas: [] };
    return {
      formaPagamento: 'custom',
      parcelas: dividir(valor, n).map((v, i) => ({ valor: mask(String(Math.round(v * 100))), data: '', descricao: `Parcela ${i + 1} de ${n}` })),
    };
  }

  /* Monta o "patch" do estado do contrato. `mask` = CI.maskMoeda (recebe dígitos em centavos). */
  function montarPatch({ dossie, acordo, mask }) {
    const eq = parseEquipamento(dossie.building_name, dossie.equip_type);
    const patch = {
      dossierIds: [dossie.id],
      equipamentosManuais: [dossie.id],
      dossieNumero: dossie.id,
      equipamento: eq.equipamento,
      quantidade: 1,
      obraCidade: dossie.city ? String(dossie.city).trim() : '',
      obraEstado: dossie.state ? String(dossie.state).trim().toUpperCase().slice(0, 2) : '',
      clienteObraId: dossie.cliente_id || null,
      clienteObraNome: dossie.client_name || '',
      clienteObraNovo: false,
      numeroContrato: null, numeroContratoBase: null,   // número nasce de novo a partir do equipamento
    };
    if (eq.equipamento === 'elevador') {
      patch.tipoElevador = eq.tipoElevador;
      if (eq.capacidadeCarga) patch.capacidadeCarga = eq.capacidadeCarga;
      if (eq.paradas) {
        const p = Number(eq.paradas);
        const op = [5, 10, 15, 20].includes(p) ? String(p) : (p > 25 ? '25+' : 'Personalizado');
        patch.paradas = op;
        if (op === 'Personalizado') patch.paradasCustom = String(p);
      }
    }
    const local = [eq.descricao, [dossie.city, dossie.state].filter(Boolean).join('/')].filter(Boolean).join(' — ');
    if (local) patch.localServico = `Obra ${dossie.client_name || ''} — ${local}`.replace('Obra  — ', 'Obra — ');
    if (acordo && Number(acordo.valor_combinado) > 0) {
      patch.valorTotal = mask(String(Math.round(Number(acordo.valor_combinado) * 100)));
      Object.assign(patch, formaPagamentoDoAcordo(acordo.parcelas_qtd, acordo.valor_combinado, mask));
      patch.acordoId = acordo.id;
    }
    return patch;
  }

  /* Extrai os números de Dossiê de um texto livre ("DOS-M013, DOS-M014" / "DOS-M013 e DOS-M014" / uma por linha). Sem repetir, em ordem. */
  function extrairNumeros(texto) {
    const achados = String(texto || '').toUpperCase().match(/DOS-[A-Z0-9]+/g);
    const lista = achados && achados.length ? achados : String(texto || '').toUpperCase().split(/[\s,;]+/).filter(Boolean);
    return lista.filter((v, i) => lista.indexOf(v) === i);
  }

  /* Vários Dossiês no MESMO contrato (um contrato = uma empresa instaladora). Devolve { patch, avisos, erro }.
     - mais de uma empresa instaladora nos Dossiês/acordos → erro (cada empresa tem o seu contrato);
     - valor = soma dos preços combinados (só quando TODOS têm acordo); parcelas = a do acordo (iguais) ou a maior;
     - tipo/capacidade/paradas vêm do 1º; se os equipamentos diferirem, avisa pra conferir no Passo 3. */
  function montarPatchVarios({ dossies, acordos, mask }) {
    const avisos = [];
    const lista = dossies || [];
    if (!lista.length) return { patch: {}, avisos, erro: 'Nenhum Dossiê informado.' };
    const porId = acordos || {};
    const primeiro = lista[0];
    const patch = montarPatch({ dossie: primeiro, acordo: null, mask });
    if (lista.length === 1) {
      const a = porId[primeiro.id];
      if (a) Object.assign(patch, montarPatch({ dossie: primeiro, acordo: a, mask }));
      return { patch, avisos, erro: null };
    }
    const ids = lista.map((d) => d.id);
    const parceiros = [...new Set(lista.map((d) => (porId[d.id] && porId[d.id].parceiro_instalador_id) || d.parceiro_instalador_id).filter(Boolean))];
    if (parceiros.length > 1) return { patch: {}, avisos, erro: 'Estes Dossiês têm empresas instaladoras diferentes — cada empresa tem o seu contrato. Informe só os Dossiês da mesma empresa.' };
    patch.dossierIds = ids;
    patch.equipamentosManuais = ids;
    patch.dossieNumero = ids.join(', ');
    patch.quantidade = ids.length;
    const eqs = lista.map((d) => parseEquipamento(d.building_name, d.equip_type));
    const difere = (k) => eqs.some((e) => e[k] !== eqs[0][k]);
    if (difere('equipamento')) avisos.push('Os Dossiês são de tipos de equipamento diferentes (elevador/escada/esteira): o contrato usa o do 1º — confira o Passo 3.');
    else if (difere('capacidadeCarga') || difere('paradas') || difere('tipoElevador')) avisos.push('Os equipamentos têm capacidade/paradas/tipo diferentes: o contrato usa os dados do 1º — confira o Passo 3.');
    if (new Set(lista.map((d) => d.client_name)).size > 1) avisos.push('Os Dossiês são de clientes/obras diferentes — confira o cliente da obra no Passo 3.');
    patch.clienteObraNome = primeiro.client_name || '';
    const local = [primeiro.building_name && String(primeiro.building_name).trim(), [primeiro.city, primeiro.state].filter(Boolean).join('/')].filter(Boolean).join(' — ');
    patch.localServico = `Obra ${primeiro.client_name || ''} — ${local} (Dossiês: ${ids.join(', ')})`.replace('Obra  — ', 'Obra — ');
    const semAcordo = ids.filter((id) => !porId[id]);
    if (semAcordo.length) {
      avisos.push(`Falta o preço combinado de: ${semAcordo.join(', ')} (Pagamentos a Instaladores › Preços combinados). O valor total não foi preenchido.`);
      delete patch.valorTotal;
    } else {
      const soma = ids.reduce((t, id) => t + Math.round(Number(porId[id].valor_combinado) * 100), 0) / 100;
      const qtds = ids.map((id) => Number(porId[id].parcelas_qtd) || 2);
      const parcelas = qtds.every((q) => q === qtds[0]) ? qtds[0] : Math.max(...qtds);
      if (!qtds.every((q) => q === qtds[0])) avisos.push(`Os acordos têm números de parcelas diferentes (${[...new Set(qtds)].join(', ')}): usei ${parcelas}x — ajuste no Passo 5 se precisar.`);
      patch.valorTotal = mask(String(Math.round(soma * 100)));
      Object.assign(patch, formaPagamentoDoAcordo(parcelas, soma, mask));
      patch.acordoId = porId[ids[0]].id;
    }
    return { patch, avisos, erro: null };
  }

  window.CIDossie = { parseEquipamento, splitLogradouro, formaPagamentoDoAcordo, montarPatch, dividir, extrairNumeros, montarPatchVarios };
}());
