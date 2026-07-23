/* ============================================================
   difal-engine.js
   Motor de cálculo do DIFAL (Diferencial de Alíquota de ICMS) — réplica
   fiel das fórmulas de DIFAL.xlsx (abas BASE/DIFAL/CÁLCULO), seguindo a
   árvore de decisão tributária atualizada da VerticalParts:
     1. UF_DESTINO = UF_ENTREGA (se preenchida) senão UF_FATURAMENTO.
     2. UF_ORIGEM == UF_DESTINO → sem DIFAL (operação interna).
     3. Finalidade "revenda" → sem DIFAL (mas alerta se não-contribuinte).
     4. Finalidade "uso_consumo_ativo" → DIFAL sempre devido; quem recolhe
        depende de ser Contribuinte de ICMS (cliente, no próprio estado)
        ou não (VerticalParts, via GNRE — bloqueia faturamento até pagar).
   window.DifalEngine
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  async function listarEstados() {
    const c = sb(); if (!c) throw new Error('Supabase não carregado');
    const { data, error } = await c.from('difal_estados').select('*').order('uf');
    if (error) throw error;
    return data || [];
  }

  async function buscarEstado(uf) {
    const c = sb(); if (!c || !uf) return null;
    const { data, error } = await c.from('difal_estados').select('*').eq('uf', uf).maybeSingle();
    if (error) throw error;
    return data || null;
  }

  function fmtMoeda(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  /* Calcula o DIFAL. params:
     { ufOrigem='SP', ufFaturamento, ufEntrega, finalidadeCompra ('revenda'|'uso_consumo_ativo'),
       contribuinteIcms (true|false|null), valorOperacao (R$), origemMercadoria ('Estrangeira'|'Nacional'),
       estadoDestino: linha de difal_estados já resolvida (buscarEstado) } */
  function calcular(params) {
    const ufOrigem = params.ufOrigem || 'SP';
    const ufFaturamento = params.ufFaturamento || '';
    const ufEntrega = params.ufEntrega || '';
    const ufDestino = ufEntrega || ufFaturamento;
    const finalidade = params.finalidadeCompra;
    const contribuinte = params.contribuinteIcms;
    const valorOperacao = Number(params.valorOperacao) || 0;
    const origemMercadoria = params.origemMercadoria || 'Estrangeira';
    const estado = params.estadoDestino;

    const base = {
      uf_origem: ufOrigem, uf_faturamento: ufFaturamento, uf_entrega: ufEntrega, uf_destino: ufDestino,
      finalidade_compra: finalidade, contribuinte_icms: contribuinte, valor_operacao: valorOperacao,
      difal_aplicavel: false, responsavel_recolhimento: null, valor_difal: 0, detalhe: null,
      exige_gnre_emitente: false, bloqueio_faturamento: false, mensagem: '', alerta: null,
    };

    if (!ufDestino) return { ...base, mensagem: 'Informe a UF de entrega ou o UF do endereço do cliente para calcular o DIFAL.' };
    if (ufOrigem === ufDestino) return { ...base, mensagem: 'Operação interna (mesmo estado da VerticalParts) — não há DIFAL.' };

    if (finalidade === 'revenda') {
      const alerta = contribuinte === false
        ? 'Atenção: Não Contribuintes do ICMS não podem comprar mercadorias com finalidade de Revenda.'
        : null;
      return { ...base, mensagem: 'Venda para comercialização (revenda) — tributada normalmente, sem incidência de DIFAL.', alerta };
    }

    if (!estado) return { ...base, mensagem: `Estado de destino (${ufDestino}) não encontrado na tabela de referência do DIFAL.` };

    const aliqInterestadual = origemMercadoria === 'Estrangeira' ? estado.aliquota_interestadual_estrangeira : estado.aliquota_interestadual_nacional;
    const aliqInterna = estado.aliquota_interna;
    const fcp = estado.fundo_combate || 0;

    let valorDifal = 0;
    let detalhe = { metodo: estado.categoria, aliq_interestadual: aliqInterestadual, aliq_interna: aliqInterna, fcp };

    switch (estado.categoria) {
      case 'Base Única': {
        valorDifal = valorOperacao * (aliqInterna - aliqInterestadual) + (fcp > 0 ? valorOperacao * fcp : 0);
        break;
      }
      case 'Base Única com FCP': {
        const semFcp = valorOperacao * (aliqInterna - aliqInterestadual);
        const valorFcp = valorOperacao * fcp;
        valorDifal = semFcp + valorFcp;
        detalhe.valor_fcp = valorFcp;
        break;
      }
      case 'Base Dupla Simples': {
        const baseDestino = (valorOperacao - valorOperacao * aliqInterestadual) / (1 - aliqInterna);
        const icmsInterestadual = baseDestino * aliqInterestadual;
        const icmsInterno = baseDestino * aliqInterna;
        valorDifal = icmsInterno - icmsInterestadual;
        Object.assign(detalhe, { base_destino: baseDestino, icms_interestadual: icmsInterestadual, icms_interno: icmsInterno });
        break;
      }
      case 'Base Dupla Composta': {
        const icmsOrigem = valorOperacao * aliqInterestadual;
        const valorLiquido = valorOperacao - icmsOrigem;
        const baseDestino = valorLiquido / (1 - aliqInterna);
        const icmsDestino = baseDestino * aliqInterna;
        valorDifal = icmsDestino - icmsOrigem;
        Object.assign(detalhe, { icms_origem: icmsOrigem, valor_liquido: valorLiquido, base_destino: baseDestino, icms_destino: icmsDestino });
        break;
      }
      case 'Base Dupla com FCP': {
        // Réplica fiel da fórmula original (DIFAL.xlsx, aba CÁLCULO — A14/B14/A18).
        // Só se aplica hoje a Alagoas e Sergipe; poucos casos reais testados —
        // recomendado validar com a Contabilidade antes do primeiro uso em produção.
        const baseComFcp = origemMercadoria === 'Nacional'
          ? (valorOperacao * (aliqInterna + fcp) + valorOperacao) - ((valorOperacao * (aliqInterna + fcp) + valorOperacao) * (aliqInterestadual - fcp))
          : valorOperacao * (aliqInterna + fcp) + valorOperacao;
        const icmsInterno = baseComFcp * aliqInterna;
        const icmsInterestadual = ufDestino === 'SE'
          ? Math.abs((baseComFcp * aliqInterestadual) - (valorOperacao * aliqInterestadual) - (baseComFcp * aliqInterestadual))
          : baseComFcp * aliqInterestadual;
        valorDifal = icmsInterno - icmsInterestadual;
        Object.assign(detalhe, { base_com_fcp: baseComFcp, icms_interno: icmsInterno, icms_interestadual: icmsInterestadual, observacao: 'Fórmula replicada da planilha original — validar com a Contabilidade.' });
        break;
      }
      default:
        return { ...base, mensagem: `Categoria de cálculo desconhecida para ${ufDestino}: ${estado.categoria}` };
    }

    if (contribuinte !== true && contribuinte !== false) {
      return { ...base, mensagem: 'Informe se o cliente é Contribuinte de ICMS para determinar o responsável pelo recolhimento do DIFAL.' };
    }

    if (contribuinte === true) {
      return {
        ...base, difal_aplicavel: true, valor_difal: valorDifal, detalhe,
        responsavel_recolhimento: 'destinatario_cliente', exige_gnre_emitente: false, bloqueio_faturamento: false,
        mensagem: `DIFAL de ${fmtMoeda(valorDifal)} é devido, mas o recolhimento é responsabilidade do próprio cliente (Contribuinte de ICMS) no estado de destino (${ufDestino}). Não é custo da VerticalParts.`,
      };
    }

    return {
      ...base, difal_aplicavel: true, valor_difal: valorDifal, detalhe,
      responsavel_recolhimento: 'emitente_verticalparts', exige_gnre_emitente: true, bloqueio_faturamento: true,
      mensagem: `DIFAL de ${fmtMoeda(valorDifal)} é responsabilidade da VerticalParts (cliente não contribuinte). Bloquear faturamento até emitir e pagar a guia GNRE em favor de ${ufDestino}.`,
      alerta: `Atenção: necessário emitir e pagar a guia GNRE a favor do estado ${ufDestino} antes do envio da carga.`,
    };
  }

  window.DifalEngine = { listarEstados, buscarEstado, calcular, fmtMoeda };
}());
