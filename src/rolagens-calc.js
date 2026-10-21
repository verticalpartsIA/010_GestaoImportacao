/* ============================================================
   rolagens-calc.js — confere o histórico de rolagens do ETD de um
   embarque (embarques_importacao.historico_rolagens) e aponta datas
   que parecem digitadas errado (19/10/2026). Só AVISA: nunca altera
   nem bloqueia a gravação. Usado pela tela do Embarque e pela
   Evolução dos equipamentos (Mapa de Obras). Também monta o
   histórico de mudanças do ETA Santos (registrarMudancaEta).
   window.RolagensCalc
   ============================================================ */
(function () {
  'use strict';

  function paraData(v) {
    if (!v) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d) ? null : d;
  }
  const fmt = (d) => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();

  /* Uma rolagem: devolve a lista de avisos (textos) sobre ela.
     anterior = a rolagem registrada antes desta (ou null). */
  function avisosDaRolagem(r, anterior) {
    const out = [];
    if (!r) return out;
    const de = paraData(r.data_anterior), para = paraData(r.nova_data), com = paraData(r.data_comunicacao);
    if (de && para && para < de) {
      out.push(`A nova data (${fmt(para)}) é anterior à data prevista (${fmt(de)}): o navio teria saído antes. Confira o mês digitado.`);
    }
    if (anterior) {
      const comAnt = paraData(anterior.data_comunicacao);
      if (com && comAnt && com < comAnt) {
        out.push(`A comunicação (${fmt(com)}) é anterior à da rolagem anterior (${fmt(comAnt)}). Confira a data.`);
      }
    }
    return out;
  }

  /* Lista inteira: [{ indice, avisos: [...] }] só das rolagens com problema. */
  function conferir(lista) {
    const l = Array.isArray(lista) ? lista : [];
    const out = [];
    l.forEach((r, i) => {
      const avisos = avisosDaRolagem(r, i > 0 ? l[i - 1] : null);
      if (avisos.length) out.push({ indice: i, avisos });
    });
    return out;
  }

  /* Histórico do ETA Santos (embarques_importacao.historico_eta, 19/10/2026): ao salvar o
     embarque com o ETA diferente do que estava gravado, acrescenta uma linha
     { data_anterior, nova_data, data_comunicacao, motivo, por }. ETA preenchido pela 1ª vez
     (sem valor anterior) não é mudança. Mesmo formato das rolagens do ETD. */
  function registrarMudancaEta(historico, anterior, nova, extra) {
    const l = Array.isArray(historico) ? historico.slice() : [];
    const a = String(anterior || '').slice(0, 10), n = String(nova || '').slice(0, 10);
    if (!a || !n || a === n) return l;
    const x = extra || {};
    l.push({
      data_anterior: a, nova_data: n,
      data_comunicacao: x.data_comunicacao || '',
      motivo: String(x.motivo || '').trim(),
      por: x.por || '',
      registrado_em: x.registrado_em || new Date().toISOString(),
    });
    return l;
  }

  window.RolagensCalc = { avisosDaRolagem, conferir, registrarMudancaEta };
}());
