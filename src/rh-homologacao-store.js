/* ============================================================
   rh-homologacao-store.js
   Validação de qualificação de Parceiro Instalador
   Certificações: NR-10, NR-35, ASO, PCMSO, PGR
   window.RHHomologacao — expõe validação e gerenciamento
   ============================================================ */
(function () {
  'use strict';

  function sb() { return (window.__VP_SB || {}).sb; }

  const CERTIFICACOES = {
    nr10: { label: 'NR-10: Segurança em Instalações Elétricas', categoria: 'seguranca' },
    nr35: { label: 'NR-35: Trabalho em Altura', categoria: 'seguranca' },
    aso: { label: 'ASO: Atestado de Saúde Ocupacional', categoria: 'saude' },
    pcmso: { label: 'PCMSO: Programa de Controle Médico', categoria: 'saude' },
    pgr: { label: 'PGR: Programa de Gerenciamento de Riscos', categoria: 'risco' },
  };

  async function salvarMontador(montadorData) {
    const c = sb();
    if (!c) throw new Error('Supabase indisponível');
    if (!montadorData.id) montadorData.id = 'MNT-' + Date.now().toString().slice(-6);

    const { error } = await c.from('parceiros_instaladores').insert(montadorData);
    if (error && error.code !== '23505') throw error; // ignora duplicate

    if (error?.code === '23505') {
      const { error: updateError } = await c.from('parceiros_instaladores')
        .update(montadorData).eq('id', montadorData.id);
      if (updateError) throw updateError;
    }

    return montadorData.id;
  }

  async function obterMontador(montadorId) {
    const c = sb();
    if (!c || !montadorId) return null;

    const { data } = await c.from('parceiros_instaladores')
      .select('*')
      .eq('id', montadorId)
      .single();

    return data || null;
  }

  async function listarMontadores() {
    const c = sb();
    if (!c) return [];

    const { data } = await c.from('parceiros_instaladores')
      .select('*')
      .order('nome', { ascending: true });

    return data || [];
  }

  function validarCertificacoes(certificacoes) {
    const hoje = new Date();
    const resultado = {
      validas: [],
      expiradas: [],
      vencendoEm30Dias: [],
      todasValidas: true,
    };

    Object.entries(certificacoes || {}).forEach(([chave, data]) => {
      if (!data || !data.data_validade) return;

      const dataValidade = new Date(data.data_validade);
      const diasRestantes = Math.floor((dataValidade - hoje) / (1000 * 60 * 60 * 24));

      const cert = { chave, ...data, diasRestantes, label: CERTIFICACOES[chave]?.label };

      if (diasRestantes < 0) {
        resultado.expiradas.push(cert);
        resultado.todasValidas = false;
      } else if (diasRestantes <= 30) {
        resultado.vencendoEm30Dias.push(cert);
      } else {
        resultado.validas.push(cert);
      }
    });

    return resultado;
  }

  function statusGeral(montador) {
    if (!montador) return 'vazio';

    const validacao = validarCertificacoes(montador.certificacoes);

    if (validacao.expiradas.length > 0) return 'expirado';
    if (validacao.vencendoEm30Dias.length > 0) return 'atencao';
    if (validacao.todasValidas && validacao.validas.length === Object.keys(CERTIFICACOES).length) {
      return 'ok';
    }
    return 'incompleto';
  }

  function statusVariant(status) {
    return status === 'ok' ? 'success'
      : status === 'expirado' ? 'danger'
      : status === 'atencao' ? 'warning'
      : status === 'incompleto' ? 'warning'
      : 'neutral';
  }

  function fmtData(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  }

  window.RHHomologacao = {
    CERTIFICACOES,
    salvarMontador,
    obterMontador,
    listarMontadores,
    validarCertificacoes,
    statusGeral,
    statusVariant,
    fmtData,
  };
})();
