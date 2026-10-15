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

  window.CIDossie = { parseEquipamento, splitLogradouro, formaPagamentoDoAcordo, montarPatch, dividir };
}());
