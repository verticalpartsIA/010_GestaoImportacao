/* ============================================================
   proposta-legado.js
   Conversor de propostas do schema antigo (site "Propostas", migrado
   pro VP Gestão em 18/08 — 307 registros reais). Extraído de
   proposta-editor.jsx (revisão de arquitetura, candidato 3): função
   pura, sem I/O, sem JSX — só dado dentro, dado transformado fora.

   window.PropostaLegado = { ehPropostaSchemaLegado, converterPropostaLegado }
   ============================================================ */
(function () {
  'use strict';

  /* Propostas criadas antes deste Editor guardaram o data_json num formato
     diferente (chaves em inglês: client/specs/elevatorUnits...). Convertemos
     pros campos que o Editor atual usa (cliente/obra/elevador.especificacoes)
     pra abrir com os dados reais, em vez de aparecer em branco.
     Detecção: data_json tem `client` mas não tem `cliente`. */
  function ehPropostaSchemaLegado(dj) {
    return !!(dj && dj.client && !dj.cliente);
  }
  /* O gerador antigo gravava `client.name` vazio — o nome real do cliente só
     sobreviveu na coluna `titulo` da linha, no formato "<Cliente> - <Equipamento>".
     Recuperamos daí (tirando só o sufixo de equipamento) pra proposta antiga
     não abrir como "Sem cliente". */
  function clienteDoTitulo(titulo) {
    if (!titulo) return '';
    return String(titulo).replace(/\s*-\s*(Elevador|Escada Rolante|Esteira Rolante)\s*$/i, '').trim();
  }

  /* Cada equipamento no schema legado tem seus próprios objetos prefixados
     (elevatorClient/escalatorClient/walkwayClient, elevatorWork/.../...,
     elevatorUnits/escalatorUnits/walkwayUnits, etc.) — o `client`/`work`
     genérico (sem prefixo) quase sempre vem vazio no gerador antigo; os
     dados reais do cliente/obra moram no objeto com prefixo do equipamento
     que a proposta realmente vendeu. Cai pro genérico só se o prefixado
     não existir. */
  function clienteObraLegado(dj, prefixo) {
    const cli = dj[`${prefixo}Client`] || dj.client || {};
    const obra = dj[`${prefixo}Work`] || dj.work || {};
    return { cli, obra };
  }
  function semUnidade(v, sufixoRe) { return String(v || '').replace(sufixoRe, '').trim(); }
  /* deepMergeProposta (proposta-editor.jsx) trata uma chave com valor
     `undefined` explícito como "sobrescreve com vazio" (Object.keys inclui
     a chave mesmo com valor undefined) — sem isso, `campo: condição ? {...}
     : undefined` apagaria o boilerplate rico do default em vez de preservá-lo
     quando o legado não tinha aquele dado. */
  function semUndef(obj) {
    const out = {};
    Object.keys(obj).forEach((k) => { if (obj[k] !== undefined) out[k] = obj[k]; });
    return out;
  }

  /* Parcelas: legado usa {value, description}; editor atual usa {valor, desc}. */
  function mapParcelasLegado(arr) {
    return (arr || []).map((p) => ({ desc: p.description || '', valor: p.value != null ? String(p.value) : '' }));
  }

  /* ---------- Elevador ---------- */
  function mapUnidadeElevadorLegado(u) {
    return {
      id: u.name || '', modelo: u.model || '', empreendimento: u.buildingType || '',
      carac: u.transportChar || '', denominacao: u.denomination || '',
      percurso: semUnidade(u.travelDistance || u.rise, /mm$/), capacidade: u.capacity || '',
      dimensoesCaixa: u.shaftDimensions || '', profPoço: semUnidade(u.pitDepth, /mm$/),
      vel: semUnidade(u.speed, /\s*m\/s$/), andaresParadasPortas: u.stops || '', qtd: u.quantity || 1,
    };
  }
  function converterElevadorLegado(dj, titulo) {
    const { cli, obra } = clienteObraLegado(dj, 'elevator');
    const unidades = dj.elevatorUnits || [];
    if (!unidades.length) return null;
    const produto = (dj.elevatorProducts && dj.elevatorProducts[0]) || {};
    const fin = dj.finishes || {};
    const somaQtd = String(unidades.reduce((s, u) => s + (Number(u.quantity) || 0), 0)) || '1';
    return {
      cliente: {
        nome: cli.name || clienteDoTitulo(titulo), cnpj: cli.cnpj || '', responsavel: cli.contactPerson || cli.contact || '',
        endereco: cli.address || '', numero: cli.number || '', bairro: cli.neighborhood || '',
        cidade: cli.city || '', uf: cli.state || '', cep: cli.zip || '', email: cli.email || '', telefone: cli.phone || '',
      },
      obra: {
        nome: obra.projectName || '', endereco: obra.address || '', numero: obra.number || '',
        bairro: obra.neighborhood || '', cidade: obra.city || '', uf: obra.state || '', cep: obra.zip || '',
      },
      elevador: semUndef({
        textoProposta: dj.elevatorIntroText || undefined,
        especificacoes: unidades.map(mapUnidadeElevadorLegado),
        acabamentos: {
          modeloCabine: fin.cabinModel || '', acabamentoMat: fin.cabinDoorFinish || '', subTeto: fin.subCeiling || '',
          painelOperacao: fin.panel || '', pisoCabina: fin.floor || '', medidasPiso: fin.cabinDimensions || '',
          modeloPorta: fin.doorModel || '', dimPortaCabine: fin.cabinDoor || '', acabPortaCabine: fin.cabinDoorFinish || '',
          portasPavimento: fin.floorDoor || '', botoeirasPavimento: fin.floorPanel || '', sinalizacao: '', pavInox: '', demais: '',
        },
        caracteristicasEquip: dj.techFeatures ? {
          alimentacao: dj.techFeatures.electrical || '', comando: dj.techFeatures.controlSystem || '', tracao: dj.techFeatures.tractionMachine || '',
        } : undefined,
        valores: {
          equipamento: produto.title || dj.specs?.type || '', quantidade: somaQtd,
          valorUnit: String(dj.financials?.unitPrice || dj.specs?.price || ''), difal: dj.elevatorDifal != null ? String(dj.elevatorDifal) : '',
          forma: dj.elevatorPaymentMethod || '', parcelas: mapParcelasLegado(dj.elevatorPaymentSchedule),
        },
        condicoesPagto: dj.financials ? {
          venda: dj.financials.paymentTerms || '', impostos: dj.elevatorTaxIncluded || dj.financials.taxIncluded || '',
          ajusteFrete: dj.elevatorFreightAdj || '',
        } : undefined,
        ajustes: {
          preset: 'sp', cambio: dj.elevatorExchangeRate || '', clausulaCambial: dj.elevatorExchangeClause || '',
          faturamentoTexto: dj.elevatorBillingText || '', taxasIn: '', taxasOut: dj.elevatorTaxExcluded || dj.financials?.taxExcluded || '',
        },
        prazo: { prazo: dj.elevatorDeliveryTimeframe || '', condCovid: dj.elevatorDeliveryConditions || '' },
        responsabilidades: dj.terms ? {
          vendedor: (dj.terms.sellerResp || '').split(/\n+/).filter(Boolean),
          comprador: (dj.terms.buyerResp || '').split(/\n+/).filter(Boolean),
        } : undefined,
        garantia: dj.terms ? { garantia: dj.terms.warranty || '', condicoes: dj.terms.general || '' } : undefined,
      }),
    };
  }

  /* ---------- Escada / Esteira (mesma forma, campos-alvo diferentes) ---------- */
  function mapUnidadeRolanteLegado(u, campoLargura) {
    return {
      id: u.name || u.clientName || '', empreendimento: u.buildingType || '', carac: u.transportChar || '',
      desnivel: semUnidade(u.rise, /mm$/), desnivelComp: semUnidade(u.rise, /mm$/),
      incl: semUnidade(u.inclination, /[º°]$/),
      [campoLargura]: (campoLargura === 'largDegrau' ? u.stepWidth : u.palletWidth) || '',
      balaustrada: semUnidade(u.balustradeHeight, /mm$/), vel: semUnidade(u.speed, /\s*m\/s$/),
      alimentacao: u.powerSupply || '', arranjo: u.arrangement || '', maquina: u.machine || '', qtd: u.quantity || 1,
      valorUnit: String(u.price || ''),
    };
  }
  function converterRolanteLegado(dj, titulo, prefixo, campoLargura) {
    const unidades = dj[`${prefixo}Units`] || [];
    if (!unidades.length) return null;
    const { cli, obra } = clienteObraLegado(dj, prefixo);
    const produto = (dj[`${prefixo}Products`] && dj[`${prefixo}Products`][0]) || {};
    const especif = dj[`${prefixo}Specifics`] || {};
    const inst = dj[`${prefixo}Installation`] || {};
    const somaQtd = String(unidades.reduce((s, u) => s + (Number(u.quantity) || 0), 0)) || '1';
    return {
      cliente: {
        nome: cli.name || clienteDoTitulo(titulo), cnpj: cli.cnpj || '', responsavel: cli.contactPerson || cli.contact || '',
        endereco: cli.address || '', numero: cli.number || '', bairro: cli.neighborhood || '',
        cidade: cli.city || '', uf: cli.state || '', cep: cli.zip || '', email: cli.email || '', telefone: cli.phone || '',
      },
      obra: {
        nome: obra.projectName || '', endereco: obra.address || '', numero: obra.number || '',
        bairro: obra.neighborhood || '', cidade: obra.city || '', uf: obra.state || '', cep: obra.zip || '',
      },
      equipamento: semUndef({
        textoProposta: dj[`${prefixo}IntroText`] || undefined,
        descricao: produto.title ? [{ titulo: produto.title, desc: produto.description || '', beneficios: produto.benefits || '' }] : undefined,
        especificacoes: unidades.map((u) => mapUnidadeRolanteLegado(u, campoLargura)),
        /* especificidades do editor atual tem só 4 campos genéricos —
           o legado tinha ~20 (comb/sill/steps/handrail/moldings/...).
           Mapeamento best-effort dos mais próximos; o resto (acabamento
           fino de degrau, iluminação, tipo de corrente etc.) não tem
           campo-destino hoje — fica só no data_json bruto, recuperável se
           o formulário ganhar esses campos no futuro. */
        especificidades: {
          corrimao: especif.handrail || '', acabamento: especif.stepFinish || especif.floorCoating || '',
          tipo: '', config: '',
        },
        valores: {
          equipamento: produto.title || '', quantidade: somaQtd, valorUnit: String(dj.financials?.unitPrice || ''),
          difal: dj[`${prefixo}Difal`] != null ? String(dj[`${prefixo}Difal`]) : '',
          forma: dj[`${prefixo}PaymentMethod`] || '', parcelas: mapParcelasLegado(dj[`${prefixo}PaymentSchedule`]),
        },
        ajustes: {
          preset: 'sp', cambio: dj[`${prefixo}ExchangeRate`] || '',
          freteMaritimo: dj[`${prefixo}FreightValue`] || '', fretePorContainer: '', ajusteFrete: dj[`${prefixo}FreightAdj`] || '',
          reajuste: dj[`${prefixo}Readjustment`] || '', taxasIn: '',
          taxasOut: dj[`${prefixo}TaxExcluded`] || dj.financials?.taxExcluded || '',
        },
        prazo: { prazo: dj[`${prefixo}DeliveryTimeframe`] || '', condCovid: dj[`${prefixo}DeliveryConditions`] || '' },
        instalacao: {
          instalacao: inst.installation || '', lubrificacao: inst.lubrication || '',
          transporte: inst.transport || '', descarregamento: inst.unloading || '',
        },
        garantia: dj.terms ? { garantia: dj.terms.warranty || '', condicoes: dj.terms.general || '' } : undefined,
      }),
    };
  }

  function converterPropostaLegado(dj, titulo) {
    const base = { numero: dj.number || '' };
    const elev = converterElevadorLegado(dj, titulo);
    if (elev) return { ...base, cliente: elev.cliente, obra: elev.obra, elevador: elev.elevador };
    const escada = converterRolanteLegado(dj, titulo, 'escalator', 'largDegrau');
    if (escada) return { ...base, cliente: escada.cliente, obra: escada.obra, escada: escada.equipamento };
    const esteira = converterRolanteLegado(dj, titulo, 'walkway', 'largPallet');
    if (esteira) return { ...base, cliente: esteira.cliente, obra: esteira.obra, esteira: esteira.equipamento };
    // Nenhuma unidade reconhecida em nenhum dos 3 equipamentos — só cliente
    // pelo título, pra não abrir "Sem cliente" à toa.
    return { ...base, cliente: { nome: clienteDoTitulo(titulo) } };
  }

  window.PropostaLegado = { ehPropostaSchemaLegado, converterPropostaLegado };
}());
