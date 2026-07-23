/* ============================================================
   precificacao-elevador-engine.js
   Motor de cálculo da Precificação de Elevador — réplica fiel da planilha
   "Modelo_Pricing_Elevador.xlsx" (aba "FIN Pricing EL"). Cada variável traz
   em comentário a célula original, pra facilitar auditoria/manutenção.
   Função pura — sem I/O, sem Supabase. window.PrecificacaoElevadorEngine
   ============================================================ */
(function () {
  'use strict';

  function creditoElegivel(regime, tipo) {
    // ICMS/IPI: qualquer regime exceto Simples aproveita crédito.
    // PIS/COFINS: só Lucro Real aproveita crédito (regime não-cumulativo).
    if (tipo === 'icms' || tipo === 'ipi') return regime !== 'Simples';
    return regime === 'Real';
  }

  /* inputs = {
       vmleUsd, seguroUsd, freteSeguroCapataziaUsd, siscomexRs, txCambial, outrasDespesasImportacaoRs,
       despachanteDesembaracoRs, demurrageRs, freteInternoRs, armazenagemRs,
       itensInstalacaoMontagem: [{descricao, valor}],
       quantidadeEquipamentos, percentualServicos,
       modelos: [{unidadeId, identificador, modelo, quantidade, valorUnitarioUsd}],
       parametros: { regimeTributario, icmsImportacaoPct, ipiImportacaoPct, pisImportacaoPct, cofinsImportacaoPct,
         iiImportacaoPct, icmsVendaPct, ipiVendaPct, pisVendaPct, cofinsVendaPct, irpjVendaPct, csllVendaPct,
         irpjAdicionalPct, impostosPagarServicosPct, markUpPct, comissaoConsultoriaPct, comissaoVendedorPct,
         comissaoIndicacaoPct },
       difalCustoRs (0 se não aplicável ou se responsabilidade é do cliente),
     } */
  function calcular(inputs) {
    const p = inputs.parametros || {};
    const regime = p.regimeTributario || 'Presumido';

    // ---------- Despesas de importação (D6:D13) ----------
    const D6_vmleUsd = Number(inputs.vmleUsd) || 0;
    const D7_seguroUsd = Number(inputs.seguroUsd) || 0;
    const D8_freteSeguroCapataziaUsd = Number(inputs.freteSeguroCapataziaUsd) || 0;
    const D9_siscomexRs = Number(inputs.siscomexRs) || 0;
    const D12_txCambial = Number(inputs.txCambial) || 0;
    const D13_outrasDespesasRs = Number(inputs.outrasDespesasImportacaoRs) || 0;
    const D11_afrmmRs = D8_freteSeguroCapataziaUsd * 0.08 * D12_txCambial;

    // ---------- Despesas extras (K6:K12) ----------
    const itensInstalacao = Array.isArray(inputs.itensInstalacaoMontagem) ? inputs.itensInstalacaoMontagem : [];
    const K11_instalacaoMontagemRs = itensInstalacao.reduce((s, it) => s + (Number(it.valor) || 0), 0);
    const K6_despachanteRs = Number(inputs.despachanteDesembaracoRs) || 0;
    const K8_demurrageRs = Number(inputs.demurrageRs) || 0;
    const K9_freteInternoRs = Number(inputs.freteInternoRs) || 0;
    const K10_armazenagemRs = Number(inputs.armazenagemRs) || 0;

    // ---------- VMLE/Seguro/Frete convertidos p/ R$ (Q20:S23) ----------
    const S20_vmleRs = D6_vmleUsd * D12_txCambial;
    const S21_seguroRs = D7_seguroUsd * D12_txCambial;
    const S22_freteRs = D8_freteSeguroCapataziaUsd * D12_txCambial;
    const S23_vmldRs = S20_vmleRs + S21_seguroRs + S22_freteRs;

    const K7_adValoremRs = S23_vmldRs * 0.001; // Ad-Valorem = VMLD * 0,1%
    const K12_despesasExtrasTotalRs = K6_despachanteRs + K7_adValoremRs + K8_demurrageRs + K9_freteInternoRs + K10_armazenagemRs + K11_instalacaoMontagemRs;

    // ---------- Cascata de impostos na importação (M24:S30) ----------
    const M24_bcII = S23_vmldRs;
    const P24_aliqII = Number(p.iiImportacaoPct) || 0;
    const S24_ii = M24_bcII * P24_aliqII;

    const M25_bcIPI = S23_vmldRs + S24_ii;
    const P25_aliqIPI = Number(p.ipiImportacaoPct) || 0;
    const S25_ipi = M25_bcIPI * P25_aliqIPI;

    const M26_bcPIS = S23_vmldRs;
    const P26_aliqPIS = Number(p.pisImportacaoPct) || 0;
    const S26_pis = M26_bcPIS * P26_aliqPIS;

    const M27_bcCOFINS = S23_vmldRs;
    const P27_aliqCOFINS = Number(p.cofinsImportacaoPct) || 0;
    const S27_cofins = M27_bcCOFINS * P27_aliqCOFINS;

    const S28_outrasBaseIcms = D9_siscomexRs + D11_afrmmRs + D13_outrasDespesasRs;
    const U29_totalAntesIcms = S23_vmldRs + S24_ii + S25_ipi + S26_pis + S27_cofins + S28_outrasBaseIcms;

    const P30_aliqICMS = Number(p.icmsImportacaoPct) || 0;
    const M30_bcICMS = U29_totalAntesIcms / (1 - P30_aliqICMS);
    const S30_icms = M30_bcICMS * P30_aliqICMS;

    const U31_totalNotaFiscal = U29_totalAntesIcms + S30_icms;
    const U32_despesasInstalacaoMontagem = K12_despesasExtrasTotalRs;
    const U33_totalDesembolso = U31_totalNotaFiscal + U32_despesasInstalacaoMontagem;

    const U34_creditos =
      (creditoElegivel(regime, 'icms') ? S30_icms : 0) +
      (creditoElegivel(regime, 'ipi') ? S25_ipi : 0) +
      (creditoElegivel(regime, 'pis') ? S26_pis : 0) +
      (creditoElegivel(regime, 'cofins') ? S27_cofins : 0);

    const U35_custoTotalMercadorias = M30_bcICMS - U34_creditos;
    const quantidadeEquipamentos = Number(inputs.quantidadeEquipamentos) || 1;
    const U36_custoPorEquipamento = U35_custoTotalMercadorias / quantidadeEquipamentos;

    // ---------- Rateio por modelo/unidade (W57:AC61) ----------
    const modelosIn = Array.isArray(inputs.modelos) ? inputs.modelos : [];
    const modelosComTotal = modelosIn.map((m) => {
      const quantidade = Number(m.quantidade) || 1;
      const valorUnitarioUsd = Number(m.valorUnitarioUsd) || 0;
      return { ...m, quantidade, valorUnitarioUsd, valorTotalUsd: quantidade * valorUnitarioUsd };
    });
    const totalUsdModelos = modelosComTotal.reduce((s, m) => s + m.valorTotalUsd, 0);

    // ---------- Cálculo do lucro / precificação (S39:V79) ----------
    const percentualServicos = Number(inputs.percentualServicos) || 0;
    const K39_icmsVendaPct = Number(p.icmsVendaPct) || 0;
    const K40_ipiVendaPct = Number(p.ipiVendaPct) || 0;
    const K41_pisVendaPct = Number(p.pisVendaPct) || 0;
    const K42_cofinsVendaPct = Number(p.cofinsVendaPct) || 0;
    const K43_irpjVendaPct = Number(p.irpjVendaPct) || 0;
    const K44_csllVendaPct = Number(p.csllVendaPct) || 0;
    const K45_irpjAdicionalPct = Number(p.irpjAdicionalPct) || 0;
    const K51_impostosServicosPct = Number(p.impostosPagarServicosPct) || 0;
    const K53_markUpPct = Number(inputs.markUpPct ?? p.markUpPct) || 0;
    const K55_comissaoConsultoriaPct = Number(inputs.comissaoConsultoriaPct ?? p.comissaoConsultoriaPct) || 0;
    const K56_comissaoVendedorPct = Number(inputs.comissaoVendedorPct ?? p.comissaoVendedorPct) || 0;
    const K57_comissaoIndicacaoPct = Number(inputs.comissaoIndicacaoPct ?? p.comissaoIndicacaoPct) || 0;

    const K50_impostosPagarProdutoPct = K39_icmsVendaPct + K40_ipiVendaPct + K41_pisVendaPct + K42_cofinsVendaPct + K43_irpjVendaPct + K44_csllVendaPct + K45_irpjAdicionalPct;
    const K63_subTotalPct = K50_impostosPagarProdutoPct + K53_markUpPct;
    const K65_precoVendaPct = 1 - K63_subTotalPct;

    const S65_precoVendaProposta = K65_precoVendaPct > 0 ? U35_custoTotalMercadorias / K65_precoVendaPct : 0;
    const S66_precoVendaProduto = S65_precoVendaProposta * (1 - percentualServicos);
    const S67_precoVendaServicos = S65_precoVendaProposta * percentualServicos;
    const U69_precoVendaPorEquipamento = S65_precoVendaProposta / quantidadeEquipamentos;

    const S39_custoIcmsVenda = -S66_precoVendaProduto * K39_icmsVendaPct;
    const S40_custoIpiVenda = -S66_precoVendaProduto * K40_ipiVendaPct;
    const S41_custoPisVenda = -(S66_precoVendaProduto + S39_custoIcmsVenda) * K41_pisVendaPct;
    const S42_custoCofinsVenda = -(S66_precoVendaProduto + S39_custoIcmsVenda) * K42_cofinsVendaPct;
    const S43_custoIrpjVenda = -(S66_precoVendaProduto * K43_irpjVendaPct);
    const S44_custoCsllVenda = -(S66_precoVendaProduto * K44_csllVendaPct);
    const S45_custoIrpjAdicional = -(S66_precoVendaProduto * K45_irpjAdicionalPct);
    const S46_creditoIcmsCompra = S30_icms;
    const S47_creditoIpiCompra = S25_ipi;
    const S48_creditoPisVenda = M26_bcPIS * 0.0165; // crédito PIS 1,65% (não-cumulativo) — referência/exibição
    const S49_creditoCofinsVenda = M27_bcCOFINS * 0.076; // crédito COFINS 7,6% (não-cumulativo) — referência/exibição
    const S50_impostosPagarProdutoRs = S39_custoIcmsVenda + S40_custoIpiVenda + S41_custoPisVenda + S42_custoCofinsVenda + S43_custoIrpjVenda + S44_custoCsllVenda + S45_custoIrpjAdicional + S46_creditoIcmsCompra + S47_creditoIpiCompra;

    const S51_impostosPagarServicosRs = -(S67_precoVendaServicos * K51_impostosServicosPct);
    const S53_markUpRs = -S65_precoVendaProposta * K53_markUpPct;
    const S55_comissaoConsultoriaRs = S65_precoVendaProposta * K55_comissaoConsultoriaPct;
    const S56_comissaoVendedorRs = S65_precoVendaProposta * K56_comissaoVendedorPct;
    const U57_comissaoIndicacaoRs = S65_precoVendaProposta * K57_comissaoIndicacaoPct;
    const U59_totalComissaoRs = S56_comissaoVendedorRs + U57_comissaoIndicacaoRs;

    const U70_difalRs = Number(inputs.difalCustoRs) || 0; // custo do DIFAL, só quando responsabilidade é da VerticalParts

    const S71_lucroVenda = S65_precoVendaProposta - U35_custoTotalMercadorias + S50_impostosPagarProdutoRs + S51_impostosPagarServicosRs - S55_comissaoConsultoriaRs - U59_totalComissaoRs - U32_despesasInstalacaoMontagem - U70_difalRs;

    const S77_lucroFinal = S71_lucroVenda; // IRPJ/CSLL adicionais sobre o lucro ficam 0 no regime Presumido (já capturados em S43/S44)
    const U78_margemFinalPct = S65_precoVendaProposta > 0 ? (S77_lucroFinal + S55_comissaoConsultoriaRs) / S65_precoVendaProposta : 0;
    const V79_lucroPorEquipamento = S77_lucroFinal / quantidadeEquipamentos;

    const modelosComRateio = modelosComTotal.map((m) => {
      const percentual = totalUsdModelos > 0 ? m.valorTotalUsd / totalUsdModelos : 0;
      const valorTotalRs = percentual * S65_precoVendaProposta;
      const valorUnitarioRs = m.quantidade > 0 ? valorTotalRs / m.quantidade : 0;
      return { ...m, percentual, valorTotalRs, valorUnitarioRs };
    });

    return {
      importacao: {
        vmleRs: S20_vmleRs, seguroRs: S21_seguroRs, freteRs: S22_freteRs, vmldRs: S23_vmldRs,
        ii: S24_ii, ipi: S25_ipi, pis: S26_pis, cofins: S27_cofins, outrasBaseIcms: S28_outrasBaseIcms,
        totalAntesIcms: U29_totalAntesIcms, bcIcms: M30_bcICMS, icms: S30_icms,
        totalNotaFiscal: U31_totalNotaFiscal, despesasInstalacaoMontagem: U32_despesasInstalacaoMontagem,
        totalDesembolso: U33_totalDesembolso, creditos: U34_creditos,
        custoTotalMercadorias: U35_custoTotalMercadorias, custoPorEquipamento: U36_custoPorEquipamento,
        afrmm: D11_afrmmRs, adValorem: K7_adValoremRs, despesasExtrasTotal: K12_despesasExtrasTotalRs,
      },
      modelos: modelosComRateio,
      precificacao: {
        impostosPagarProdutoPct: K50_impostosPagarProdutoPct, subTotalPct: K63_subTotalPct, precoVendaPct: K65_precoVendaPct,
        precoVendaProposta: S65_precoVendaProposta, precoVendaProduto: S66_precoVendaProduto, precoVendaServicos: S67_precoVendaServicos,
        precoVendaPorEquipamento: U69_precoVendaPorEquipamento,
        custosIcmsVenda: S39_custoIcmsVenda, custosIpiVenda: S40_custoIpiVenda, custosPisVenda: S41_custoPisVenda,
        custosCofinsVenda: S42_custoCofinsVenda, custosIrpjVenda: S43_custoIrpjVenda, custosCsllVenda: S44_custoCsllVenda,
        custosIrpjAdicional: S45_custoIrpjAdicional,
        creditoIcmsCompra: S46_creditoIcmsCompra, creditoIpiCompra: S47_creditoIpiCompra,
        creditoPisVenda: S48_creditoPisVenda, creditoCofinsVenda: S49_creditoCofinsVenda,
        impostosPagarProdutoRs: S50_impostosPagarProdutoRs, impostosPagarServicosRs: S51_impostosPagarServicosRs,
        markUpRs: S53_markUpRs, comissaoConsultoriaRs: S55_comissaoConsultoriaRs, comissaoVendedorRs: S56_comissaoVendedorRs,
        comissaoIndicacaoRs: U57_comissaoIndicacaoRs, totalComissaoRs: U59_totalComissaoRs,
        difalRs: U70_difalRs,
        lucroVenda: S71_lucroVenda, lucroFinal: S77_lucroFinal, margemFinalPct: U78_margemFinalPct,
        lucroPorEquipamento: V79_lucroPorEquipamento,
      },
    };
  }

  window.PrecificacaoElevadorEngine = { calcular, creditoElegivel };
}());
