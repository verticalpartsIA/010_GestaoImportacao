/* ============================================================
   mapa-obras-calc.js — regras puras do Mapa de Obras (19/10/2026).
   Classifica cada dossiê de obra (dossier_obra.status_master) em:
     andamento  — obra em instalação (ou equipamento já entregue esperando montar)
     concluida  — Data Book / Entregue / Manutenção preventiva
     aguardando — contrato assinado, importação ou homologação do instalador,
                  com o equipamento ainda não entregue na obra
   Fases antes do contrato (análise técnica, proposta…) não entram no mapa.
   Posição: a gravada no dossiê (latitude/longitude, vinda do endereço
   completo); sem ela, o centro da cidade. Obras no mesmo ponto são
   espalhadas num pequeno círculo.
   window.MapaObrasCalc
   ============================================================ */
(function () {
  'use strict';

  const SITUACOES = {
    andamento:  { rotulo: 'Em andamento',            cor: '#f59e0b' },
    concluida:  { rotulo: 'Concluída',               cor: '#16a34a' },
    aguardando: { rotulo: 'Aguardando equipamentos', cor: '#2563eb' },
  };
  const CONCLUIDAS = ['DataBook', 'Entregue', 'Manutenção preventiva'];
  const AGUARDANDO = ['Contrato assinado', 'Importação', 'Homologação instalador'];

  function classificar(d) {
    const st = String((d && d.status_master) || '').trim();
    if (CONCLUIDAS.includes(st)) return 'concluida';
    if (st === 'Instalação') return 'andamento';
    if (AGUARDANDO.includes(st)) return d.equipamento_entregue ? 'andamento' : 'aguardando';
    return null;
  }

  function chaveCidade(cidade, uf) {
    const sem = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
    if (!sem(cidade)) return null;
    return `${sem(cidade)}|${sem(uf)}`;
  }

  /* Posição de cada obra: centro da cidade, ou espalhada num círculo quando há mais de uma obra na cidade. */
  function espalhar(centro, indice, total) {
    if (!centro || total <= 1) return centro ? [centro.lat, centro.lon] : null;
    const raio = 0.012 + 0.0015 * Math.min(total, 20); // ~1,3 a 4,5 km
    const ang = (2 * Math.PI * indice) / total;
    const fatorLon = 1 / Math.max(0.2, Math.cos((centro.lat * Math.PI) / 180));
    return [centro.lat + raio * Math.sin(ang), centro.lon + raio * Math.cos(ang) * fatorLon];
  }

  const limpo = (v) => String(v == null ? '' : v).trim();
  function cepFormatado(cep) {
    const d = limpo(cep).replace(/\D/g, '');
    return d.length === 8 ? d.slice(0, 5) + '-' + d.slice(5) : '';
  }

  /* "Avenida X, 70 - Boqueirão, Praia Grande/SP · CEP 11700-005" (só as partes que existem). */
  function enderecoTexto(d) {
    if (!d) return '';
    const rua = [limpo(d.endereco_logradouro), limpo(d.endereco_numero)].filter(Boolean).join(', ');
    const ruaComp = [rua, limpo(d.endereco_complemento)].filter(Boolean).join(' ');
    const local = [limpo(d.city), limpo(d.state)].filter(Boolean).join('/');
    const partes = [[ruaComp, limpo(d.endereco_bairro)].filter(Boolean).join(' - '), local].filter(Boolean).join(', ');
    const cep = cepFormatado(d.endereco_cep);
    return [partes, cep ? 'CEP ' + cep : ''].filter(Boolean).join(' · ');
  }

  /* Consultas ao geocodificador, da mais precisa para a menos precisa.
     Sem rua nem CEP não há consulta (a obra fica no centro da cidade, sem gravar nada). */
  function consultasGeocode(d) {
    if (!d) return [];
    const cidade = limpo(d.city), uf = limpo(d.state);
    const out = [];
    const rua = limpo(d.endereco_logradouro);
    if (rua && cidade) {
      out.push({ precisao: 'endereco', q: [[rua, limpo(d.endereco_numero)].filter(Boolean).join(' '), cidade, uf, 'Brasil'].filter(Boolean).join(', ') });
    }
    const cep = cepFormatado(d.endereco_cep);
    if (cep) out.push({ precisao: 'cep', q: [cep, cidade, uf, 'Brasil'].filter(Boolean).join(', ') });
    return out;
  }

  /* Posição gravada no dossiê vale; senão null (o mapa tenta o endereço, depois a cidade). */
  function posicaoGravada(d) {
    const lat = Number(d && d.latitude), lon = Number(d && d.longitude);
    if (!d || d.latitude == null || d.longitude == null || !isFinite(lat) || !isFinite(lon)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat, lon, precisao: d.geo_precisao || 'manual' };
  }

  window.MapaObrasCalc = { SITUACOES, classificar, chaveCidade, espalhar, cepFormatado, enderecoTexto, consultasGeocode, posicaoGravada };
}());
