/* ============================================================
   mapa-obras-calc.js — regras puras do Mapa de Obras (19/10/2026).
   Classifica cada dossiê de obra (dossier_obra.status_master) em:
     andamento  — obra em instalação (ou equipamento já entregue esperando montar)
     concluida  — Data Book / Entregue / Manutenção preventiva
     aguardando — contrato assinado, importação ou homologação do instalador,
                  com o equipamento ainda não entregue na obra
   Fases antes do contrato (análise técnica, proposta…) não entram no mapa.
   A posição é o CENTRO DA CIDADE da obra (o dossiê só tem cidade/UF);
   várias obras na mesma cidade são espalhadas num pequeno círculo.
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

  window.MapaObrasCalc = { SITUACOES, classificar, chaveCidade, espalhar };
}());
