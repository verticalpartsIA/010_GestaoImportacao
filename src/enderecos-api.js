/* ============================================================
   enderecos-api.js — Consulta de CEP (BrasilAPI, com fallback ViaCEP)
   e CNPJ (BrasilAPI), pra autopreencher endereço/dados fiscais nos
   formulários. Sem build step — plain JS, expõe window.EnderecoAPI.
   ============================================================ */
(function () {
  'use strict';

  function sanitizeDigits(v) {
    return (v || '').replace(/\D/g, '');
  }
  function isCepValido(cep) { return sanitizeDigits(cep).length === 8; }
  /* CPF/CNPJ de verdade (04/10/2026): tamanho + dígitos verificadores; recusa sequência repetida (000.000.000-00 etc.). */
  function cpfConfere(d) {
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
  }
  function cnpjConfere(d) {
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
    const dv = (n) => { const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * pesos[i]; const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
  }
  function isCnpjValido(cnpj) { return cnpjConfere(sanitizeDigits(cnpj)); }
  function isCpfValido(cpf) { return cpfConfere(sanitizeDigits(cpf)); }
  /* O documento tem que COINCIDIR com o tipo escolhido na lista (PF = CPF de 11 dígitos; PJ = CNPJ de 14). Vazio é aceito (documento
     pendente) — quem chama decide se é obrigatório. Devolve { ok, digitos, msg }. */
  function validarDocumento(tipoPessoa, valor) {
    const d = sanitizeDigits(valor);
    if (!d) return { ok: true, digitos: '', msg: '' };
    const pf = tipoPessoa === 'PF';
    const nome = pf ? 'CPF' : 'CNPJ';
    const esperado = pf ? 11 : 14;
    if (d.length !== esperado) {
      const outro = d.length === 14 ? ' (parece um CNPJ)' : d.length === 11 ? ' (parece um CPF)' : '';
      const sugestao = d.length === 14 && pf ? ' Troque o tipo para Pessoa Jurídica ou corrija o número.' : d.length === 11 && !pf ? ' Troque o tipo para Pessoa Física ou corrija o número.' : '';
      return { ok: false, digitos: d, msg: `${pf ? 'Pessoa Física' : 'Pessoa Jurídica'} pede ${nome} com ${esperado} dígitos, mas o número tem ${d.length}${outro}.${sugestao}` };
    }
    if (!(pf ? cpfConfere(d) : cnpjConfere(d))) return { ok: false, digitos: d, msg: `${nome} inválido — os dígitos verificadores não conferem. Confira o número.` };
    return { ok: true, digitos: d, msg: '' };
  }

  async function fetchComTimeout(url, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  function normalizarCepBrasilApi(d) {
    return {
      cep: sanitizeDigits(d.cep),
      logradouro: d.street || '',
      bairro: d.neighborhood || '',
      cidade: d.city || '',
      estado: d.state || '',
    };
  }
  function normalizarCepViaCep(d) {
    return {
      cep: sanitizeDigits(d.cep),
      logradouro: d.logradouro || '',
      bairro: d.bairro || '',
      cidade: d.localidade || '',
      estado: d.uf || '',
    };
  }

  async function buscarCepViaCep(cep) {
    const res = await fetchComTimeout(`https://viacep.com.br/ws/${cep}/json/`, 3000);
    if (!res.ok) throw new Error('CEP não encontrado.');
    const data = await res.json();
    if (data.erro) throw new Error('CEP não encontrado.');
    return normalizarCepViaCep(data);
  }

  /* Principal: BrasilAPI v2. Qualquer erro de rede, HTTP não-ok ou timeout
     (>3s) cai automaticamente pro fallback ViaCEP antes de desistir. */
  async function buscarCEP(cepRaw) {
    const cep = sanitizeDigits(cepRaw);
    if (!isCepValido(cep)) throw new Error('CEP inválido — informe 8 dígitos.');
    try {
      const res = await fetchComTimeout(`https://brasilapi.com.br/api/cep/v2/${cep}`, 3000);
      if (!res.ok) return await buscarCepViaCep(cep);
      return normalizarCepBrasilApi(await res.json());
    } catch (e) {
      return await buscarCepViaCep(cep);
    }
  }

  function montarLogradouro(d) {
    const via = [d.descricao_tipo_logradouro, d.logradouro].filter(Boolean).join(' ').trim();
    if (via && d.numero) return `${via}, ${d.numero}`;
    return via || d.numero || '';
  }

  /* Extrai o número (+ complemento) que o usuário digitou inline no logradouro,
     no formato documentado "Rua X, 150" (placeholder do campo). Só considera
     um número precedido de vírgula, pra não confundir com dígitos no nome da
     rua (ex.: "Rua 25 de Março"). */
  function extrairNumeroLogradouro(logradouro) {
    const m = (logradouro || '').match(/,\s*(\d[^,]*(?:,.*)?)$/);
    return m ? m[1].trim() : '';
  }

  /* Mescla o logradouro vindo de CEP/CNPJ (geralmente só a rua, sem número)
     com o que o usuário já digitou, preservando o número. Sem isso, o
     autopreenchimento por CEP apagava o número do endereço em silêncio
     (ex.: "Avenida Paulista, 1000" virava "Avenida Paulista"). */
  function mesclarLogradouro(atual, novo) {
    const rua = (novo || '').trim();
    if (!rua) return (atual || '').trim();
    const numero = extrairNumeroLogradouro(atual);
    const novoJaTemNumero = /,\s*\d/.test(rua);
    if (numero && !novoJaTemNumero) return `${rua}, ${numero}`;
    return rua;
  }

  async function buscarCNPJ(cnpjRaw) {
    const cnpj = sanitizeDigits(cnpjRaw);
    if (!isCnpjValido(cnpj)) throw new Error('CNPJ inválido — informe 14 dígitos.');
    let res;
    try {
      res = await fetchComTimeout(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, 5000);
    } catch (e) {
      throw new Error('Serviço de consulta de CNPJ temporariamente indisponível.');
    }
    if (res.status === 404) throw new Error('CNPJ não encontrado.');
    if (!res.ok) throw new Error('Serviço de consulta de CNPJ temporariamente indisponível.');
    const d = await res.json();
    const descSituacao = d.descricao_situacao_cadastral || '';
    return {
      cnpj: d.cnpj || cnpj,
      razao_social: d.razao_social || '',
      nome_fantasia: d.nome_fantasia || '',
      situacao_cadastral: descSituacao,
      status: /ativa/i.test(descSituacao) ? 'ativo' : 'inativo',
      telefone: d.ddd_telefone_1 || '',
      endereco: {
        logradouro: montarLogradouro(d),
        complemento: d.complemento || '',
        bairro: d.bairro || '',
        cep: sanitizeDigits(d.cep),
        cidade: d.municipio || '',
        estado: d.uf || '',
      },
      cnaes: {
        principal: d.cnae_fiscal ? { codigo: d.cnae_fiscal, descricao: d.cnae_fiscal_descricao || '' } : null,
        secundarios: Array.isArray(d.cnaes_secundarios)
          ? d.cnaes_secundarios.map((c) => ({ codigo: c.codigo, descricao: c.descricao }))
          : [],
      },
    };
  }

  window.EnderecoAPI = { sanitizeDigits, isCepValido, isCnpjValido, isCpfValido, validarDocumento, buscarCEP, buscarCNPJ, extrairNumeroLogradouro, mesclarLogradouro };
})();
