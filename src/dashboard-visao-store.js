/* ============================================================
   dashboard-visao-store.js — lê, uma vez por sessão, quem é a pessoa (perfis.nivel), o departamento
   (colaboradores_vpsistema) e as alçadas dela (alcadas_capacidade). Só LÊ. Falha em qualquer leitura = `falhou: true`
   (a tela mostra tudo, nunca esconde por erro). window.DashboardVisaoStore.useVisao() é o hook usado pelo Dashboard e pelo cabeçalho.
   ============================================================ */
(function () {
  'use strict';
  let promessa = null;
  let atual = null;

  async function carregar() {
    const email = String((window.__VP_USER || {}).email || '').trim();
    const sb = window.__VP_SB && window.__VP_SB.sb;
    if (!email || !sb || /@localhost$/i.test(email)) return { pronto: true, semDados: true };
    try {
      const rp = await sb.from('perfis').select('id, nivel').eq('email', email).maybeSingle();
      if (rp.error || !rp.data) return { pronto: true, semDados: true };
      const ehAdmin = rp.data.nivel === 'Administrador';
      const [rd, ra] = await Promise.all([
        sb.from('colaboradores_vpsistema').select('departamento').ilike('email', email).limit(1),
        ehAdmin ? Promise.resolve({ data: [] }) : sb.from('alcadas_capacidade').select('modulo, capacidade').eq('perfil_id', rp.data.id),
      ]);
      if (rd.error || ra.error) return { pronto: true, semDados: true };
      const caps = new Set((ra.data || []).map((a) => a.modulo + '.' + a.capacidade));
      return { pronto: true, semDados: false, ehAdmin, perfilId: rp.data.id, departamento: ((rd.data || [])[0] || {}).departamento || '', caps };
    } catch (e) { return { pronto: true, semDados: true }; }
  }

  function obter() {
    if (!promessa) promessa = carregar().then((v) => { atual = v; return v; });
    return promessa;
  }
  function reiniciar() { promessa = null; atual = null; }

  function useVisao() {
    const [v, setV] = React.useState(atual);
    React.useEffect(() => {
      let vivo = true;
      obter().then((x) => { if (vivo) setV(x); });
      const aoTrocarUsuario = () => { reiniciar(); setV(null); obter().then((x) => { if (vivo) setV(x); }); };
      window.addEventListener('vpprd:user', aoTrocarUsuario);
      return () => { vivo = false; window.removeEventListener('vpprd:user', aoTrocarUsuario); };
    }, []);
    return v;   // null = ainda carregando
  }

  window.DashboardVisaoStore = { obter, reiniciar, useVisao };
}());
