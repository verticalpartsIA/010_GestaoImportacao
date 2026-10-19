/* ============================================================
   rolagens-calc.js — confere o histórico de rolagens do ETD de um
   embarque (embarques_importacao.historico_rolagens) e aponta datas
   que parecem digitadas errado (19/10/2026). Só AVISA: nunca altera
   nem bloqueia a gravação. Usado pela tela do Embarque e pela
   Evolução dos equipamentos (Mapa de Obras).
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

  window.RolagensCalc = { avisosDaRolagem, conferir };
}());
