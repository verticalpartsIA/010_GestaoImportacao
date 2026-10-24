/* ============================================================
   evolucao-conferir-calc.js — "dado a conferir" da Evolução dos Equipamentos
   (24/10/2026). Regras puras que apontam dado incoerente ou parado nas telas
   que alimentam a Evolução: Dossiê/equipamentos_obra (cadastro, hoje com o
   gestor Felipe Barros) e Diário de Obra (montadores).
   Só LÊ e aponta; nunca corrige. Cada achado: { codigo, gravidade, motivo, quem }
   - gravidade: 'alta' | 'media'
   - quem: 'felipe' (cadastro/gestão) | 'montador' (Diário de Obra)
   Dias úteis aqui = seg–sex (feriados só no aviso do gi-avisos).
   window.EvolucaoConferirCalc
   Item esperado (o mesmo montado por useEvolucaoItens):
     { obra:{id,situacao,status_master,updated_at,client_name,building_name,city},
       serie, eq:{...equipamentos_obra}|null, linha?, diario:{pct,iniciadoEm}|null }
   ============================================================ */
(function () {
  'use strict';

  const DIA = 86400000;
  const DIAS_PARADO = 14;          // registro sem edição há mais que isso = "parado"
  const DIAS_UTEIS_SEM_DIARIO = 3; // obra em Instalação sem Diário há 3 dias úteis
  const DIAS_REPLANEJAR = 14;      // real × previsto acima disso = previsão desatualizada
  const DIAS_DESTOA_IRMAOS = 60;   // chegada real muito diferente da dos irmãos
  const ALTA_APOS_DIAS = 30;

  function ev() { return (typeof window !== 'undefined' && window.EvolucaoEquipamentosCalc) || null; }
  function paraData(v) {
    const E = ev();
    if (E && E.paraData) return E.paraData(v);
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d) ? null : d;
  }
  const inicioDoDia = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const dias = (a, b) => Math.round((inicioDoDia(b) - inicioDoDia(a)) / DIA);
  const fmt = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

  /* Dias úteis (seg–sex) em (a, b]. */
  function diasUteis(a, b) {
    const ini = inicioDoDia(a), fim = inicioDoDia(b);
    let n = 0;
    for (let d = new Date(ini.getTime() + DIA); d <= fim; d = new Date(d.getTime() + DIA)) {
      const w = d.getDay();
      if (w !== 0 && w !== 6) n++;
    }
    return n;
  }

  const chaveObra = (o) => [o.client_name, o.building_name, o.city].map((x) => String(x || '').trim().toLowerCase()).join('|');
  const achado = (codigo, gravidade, motivo, quem, extra) => ({ codigo, gravidade, motivo, quem: quem || 'felipe', ...(extra || {}) });

  function avaliarUm(it, irmaos, hoje) {
    const o = it.obra || {}, e = it.eq || {};
    const out = [];
    const concluida = o.situacao === 'concluida';
    const fase = String(o.status_master || '').trim();
    const upd = o.updated_at ? inicioDoDia(new Date(o.updated_at)) : null;

    const real = {
      chegada: paraData(e.chegada_real_material),
      inicio: paraData(e.data_real_inicio),
      termino: paraData(e.data_real_termino),
    };
    const prev = {
      chegada: paraData(e.previsao_chegada_material),
      inicio: paraData(e.previsao_inicio),
      termino: paraData(e.previsao_termino),
    };
    const ROT = { chegada: 'chegada do material', inicio: 'início', termino: 'término' };

    /* R1 — data real no futuro, ou depois da última edição do dossiê. */
    ['chegada', 'inicio', 'termino'].forEach((k) => {
      const r = real[k];
      if (!r) return;
      if (inicioDoDia(r) > hoje) {
        out.push(achado('real_no_futuro', 'alta', `A data real de ${ROT[k]} (${fmt(r)}) ainda não aconteceu — provavelmente é a previsão digitada no campo "real".`));
      } else if (upd && dias(upd, r) > 1) {
        out.push(achado('real_apos_edicao', 'media', `A data real de ${ROT[k]} (${fmt(r)}) é posterior à última edição do dossiê (${fmt(upd)}) — confira se foi digitada certa.`));
      }
    });

    /* R2 — ordem das etapas. */
    if (real.chegada && real.inicio && real.inicio < real.chegada) {
      out.push(achado('ordem_invalida', 'alta', `O início real (${fmt(real.inicio)}) é anterior à chegada do material (${fmt(real.chegada)}).`));
    }
    if (real.inicio && real.termino && real.termino < real.inicio) {
      out.push(achado('ordem_invalida', 'alta', `O término real (${fmt(real.termino)}) é anterior ao início real (${fmt(real.inicio)}).`));
    }

    /* R3 — término registrado mas a fase não avançou. */
    if (real.termino && fase === 'Instalação') {
      out.push(achado('fase_nao_avancou', 'media', `Término real em ${fmt(real.termino)}, mas o dossiê continua na fase "Instalação" (deveria ir para DataBook/Entregue).`));
    }

    /* R4 + R9 — previsão vencida sem data real (a mais atrasada de cada equipamento). */
    if (!concluida) {
      const iniciou = !!(real.inicio || (it.diario && it.diario.iniciadoEm));
      const venc = [];
      if (prev.chegada && !real.chegada && !o.equipamento_entregue) venc.push(['chegada', prev.chegada]);
      if (prev.inicio && !iniciou) venc.push(['inicio', prev.inicio]);
      if (prev.termino && !real.termino) venc.push(['termino', prev.termino]);
      const vencidas = venc.filter(([, d]) => diasUteis(d, hoje) >= 1);
      if (vencidas.length) {
        vencidas.sort((a, b) => a[1] - b[1]);
        const [k, d] = vencidas[0];
        const n = dias(d, hoje);
        const parado = upd ? dias(upd, hoje) : null;
        const sufixo = parado != null && parado > DIAS_PARADO ? `, sem edição há ${parado} dias` : '';
        out.push(achado('previsao_vencida', n > ALTA_APOS_DIAS ? 'alta' : 'media',
          `Previsão de ${ROT[k]} vencida há ${plural(n, 'dia', 'dias')} (${fmt(d)})${sufixo}.`, 'felipe', { dias: n }));
      }
    }

    /* R5 — previsão que ficou para trás depois de um fato novo. */
    if (real.chegada && prev.inicio && !real.inicio && prev.inicio < real.chegada) {
      out.push(achado('previsao_antes_da_chegada', 'media', `O início previsto (${fmt(prev.inicio)}) é anterior à chegada real do material (${fmt(real.chegada)}) — replanejar.`));
    }
    [['inicio', 'início'], ['chegada', 'chegada do material']].forEach(([k, rot]) => {
      if (real[k] && prev[k] && Math.abs(dias(prev[k], real[k])) > DIAS_REPLANEJAR) {
        out.push(achado('previsao_desatualizada', 'media', `${rot[0].toUpperCase() + rot.slice(1)} real em ${fmt(real[k])} contra ${fmt(prev[k])} previsto (${Math.abs(dias(prev[k], real[k]))} dias de diferença) — atualizar as previsões.`));
      }
    });

    /* R6 — Diário de Obra sem lançamentos (montador). */
    if (fase === 'Instalação' && !concluida && it.diario && !it.diario.iniciadoEm && !(Number(it.diario.pct) > 0)) {
      const ch = real.chegada || paraData(o.equipamento_entregue_em);
      if (!ch || diasUteis(ch, hoje) >= DIAS_UTEIS_SEM_DIARIO) {
        out.push(achado('sem_diario', 'media', 'Obra em Instalação sem nenhum lançamento no Diário de Obra (o progresso aparece 0%).', 'montador'));
      }
    }

    /* R7 — cadastro incompleto. */
    if (!concluida && !it.serie) out.push(achado('sem_serie', 'media', 'Equipamento sem nº de série cadastrado.'));
    const texto = [o.building_name, o.client_name].join(' ');
    if (/remo[cç][aã]o/i.test(texto) && (!it.linha || it.linha.atualKey === 'embarque' || it.linha.atualKey === 'porto')) {
      out.push(achado('remocao_sem_fabrica', 'media', 'Obra de remoção não tem "saída da fábrica"/importação — a linha do tempo está mostrando uma etapa que não se aplica.'));
    }

    /* R8 — irmãos (mesma obra) preenchidos de forma diferente. */
    if (irmaos.length > 1 && !concluida) {
      const outros = irmaos.filter((x) => x !== it);
      const iniciouOutro = outros.find((x) => x.eq && paraData(x.eq.data_real_inicio));
      if (iniciouOutro && !real.inicio) {
        out.push(achado('irmao_iniciou', 'media', `O equipamento ${iniciouOutro.serie || 'irmão'} da mesma obra já tem início real e este não.`));
      }
      if (real.chegada) {
        const dist = outros.map((x) => (x.eq && paraData(x.eq.chegada_real_material)) || null).filter(Boolean).map((d) => Math.abs(dias(d, real.chegada)));
        if (dist.length && Math.min.apply(null, dist) > DIAS_DESTOA_IRMAOS) {
          out.push(achado('chegada_destoa_irmaos', 'media', `Chegada do material em ${fmt(real.chegada)} destoa dos equipamentos da mesma obra (mais de ${DIAS_DESTOA_IRMAOS} dias de diferença) — possível mês digitado errado.`));
        }
      }
    }
    return out;
  }

  /* itens → Map(item → achados[]). */
  function avaliar(itens, ctx) {
    const hoje = inicioDoDia((ctx && ctx.hoje) || new Date());
    const grupos = {};
    (itens || []).forEach((it) => { const k = chaveObra(it.obra || {}); (grupos[k] = grupos[k] || []).push(it); });
    const out = new Map();
    (itens || []).forEach((it) => out.set(it, avaliarUm(it, grupos[chaveObra(it.obra || {})] || [it], hoje)));
    return out;
  }

  const peso = (a) => (a.gravidade === 'alta' ? 0 : 1);
  /* Lista plana, separada por quem corrige, mais graves primeiro. */
  function resumo(itens, ctx) {
    const porItem = avaliar(itens, ctx);
    const felipe = [], montador = [];
    porItem.forEach((lista, it) => lista.forEach((a) => {
      const linha = { ...a, item: it, serie: it.serie || null, obraId: it.obra && it.obra.id };
      (a.quem === 'montador' ? montador : felipe).push(linha);
    }));
    const ord = (a, b) => (peso(a) - peso(b)) || ((b.dias || 0) - (a.dias || 0));
    felipe.sort(ord); montador.sort(ord);
    return { felipe, montador, total: felipe.length + montador.length, porItem };
  }

  const api = { avaliar, resumo, diasUteis, LIMITES: { DIAS_PARADO, DIAS_UTEIS_SEM_DIARIO, DIAS_REPLANEJAR, DIAS_DESTOA_IRMAOS } };
  if (typeof window !== 'undefined') window.EvolucaoConferirCalc = api;
}());
