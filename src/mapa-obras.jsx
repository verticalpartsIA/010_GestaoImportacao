/* ============================================================
   mapa-obras.jsx — Mapa de Obras (Obras & Instalação, 19/10/2026).
   Mesma engenharia do mapa do Rastreio Marítimo (Leaflet + trocador de
   estilo Claro/Escuro/Ruas/Satélite). Um ponto por dossiê de obra:
   em andamento (amarelo), concluída (verde), aguardando equipamentos (azul).
   Passar o mouse mostra a obra; em andamento mostra também o status e quem
   está instalando. Clique abre o Dossiê da Obra.
   Posição: a gravada no dossiê (latitude/longitude). Sem ela, o mapa localiza
   o endereço completo do dossiê (Nominatim/OpenStreetMap) e grava a posição
   no dossiê; sem endereço, usa o centro da cidade (guardado no navegador).
   ============================================================ */

const MO_MAP_STYLES = [
  { key: "claro", label: "Claro", url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles © Esri — Esri, HERE, Garmin, FAO, NOAA, USGS" },
  { key: "escuro", label: "Escuro", url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles © Esri — Esri, HERE, Garmin, FAO, NOAA, USGS" },
  { key: "ruas", label: "Ruas", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors", subdomains: "abc" },
  { key: "satelite", label: "Satélite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics" },
];

const MO_GEO_CACHE_KEY = "vp_mapa_obras_geo_v1";

function moLerCacheGeo() {
  try { return JSON.parse(localStorage.getItem(MO_GEO_CACHE_KEY) || "{}") || {}; } catch (_) { return {}; }
}
function moGravarCacheGeo(c) {
  try { localStorage.setItem(MO_GEO_CACHE_KEY, JSON.stringify(c)); } catch (_) { /* sem armazenamento: geocodifica de novo na próxima vez */ }
}
const moEsc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const moData = (d) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

/* Geocodifica as cidades que faltam, uma por vez (o Nominatim pede no máximo 1 consulta por segundo). */
async function moGeocodificarCidades(cidades, onProgresso) {
  const cache = moLerCacheGeo();
  const faltam = cidades.filter((c) => !(c.chave in cache));
  for (let i = 0; i < faltam.length; i++) {
    const c = faltam[i];
    try {
      const q = `${String(c.cidade).trim()}, ${String(c.uf || "").trim()}, Brasil`;
      const r = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=" + encodeURIComponent(q));
      if (r.ok) {
        const d = await r.json();
        cache[c.chave] = Array.isArray(d) && d.length ? { lat: Number(d[0].lat), lon: Number(d[0].lon) } : null;
        moGravarCacheGeo(cache);
      }
    } catch (_) { /* falha de rede: a cidade fica sem ponto nesta abertura e é tentada de novo depois */ }
    onProgresso && onProgresso({ ...cache });
    if (i < faltam.length - 1) await new Promise((res) => setTimeout(res, 1100));
  }
  return cache;
}

/* Localiza o endereço completo da obra. Só aceita resultado a até 60 km do centro da
   cidade (quando conhecido) — o Nominatim às vezes devolve uma rua homônima em outro lugar. */
async function moGeocodificarEndereco(o, centroCidade) {
  const consultas = window.MapaObrasCalc.consultasGeocode(o);
  for (let i = 0; i < consultas.length; i++) {
    const c = consultas[i];
    try {
      if (i > 0) await new Promise((res) => setTimeout(res, 1100));
      const r = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=" + encodeURIComponent(c.q));
      if (!r.ok) continue;
      const d = await r.json();
      if (!Array.isArray(d) || !d.length) continue;
      const pos = { lat: Number(d[0].lat), lon: Number(d[0].lon), precisao: c.precisao };
      if (!isFinite(pos.lat) || !isFinite(pos.lon)) continue;
      if (centroCidade && window.DistanciaObra && window.DistanciaObra.haversineKm(centroCidade, pos) > 60) continue;
      return pos;
    } catch (_) { /* falha de rede: tenta a próxima consulta ou deixa no centro da cidade */ }
  }
  return null;
}

/* Equipamentos da obra (aba Evolução) dentro do balão do mapa. */
function moEquipamentosHtml(eqs) {
  if (!eqs || !eqs.length) return "";
  const lin = eqs.slice(0, 6).map((it) => {
    const l = it.linha;
    const p = l.passos.find((x) => x.key === l.atualKey);
    const etapa = p ? (p.rotulo + (p.data && p.estado === "previsto" ? " (prev. " + p.data.toLocaleDateString("pt-BR") + ")" : "")) : "Concluído";
    const nOc = it.oc ? it.oc.lista.length : 0;
    return `<div style="font-size:12px;margin-top:2px;max-width:320px;white-space:normal"><b style="font-family:ui-monospace,monospace">${moEsc(it.serie || "sem nº de série")}</b> · ${moEsc(etapa)}`
      + (it.obra.situacao !== "aguardando" ? ` · ${l.pct}%` : "")
      + (l.atrasada ? ` · <span style="color:#dc2626;font-weight:600">previsão vencida</span>` : "")
      + (nOc ? ` · <span style="color:#d97706;font-weight:600">${nOc} ocorrência(s)</span>` : "") + `</div>`;
  });
  if (eqs.length > 6) lin.push(`<div style="font-size:11px;color:#64748b">+ ${eqs.length - 6} equipamento(s)</div>`);
  return `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #e2e8f0"><div style="font-size:11px;color:#64748b;font-weight:600">Equipamentos (${eqs.length})</div>${lin.join("")}</div>`;
}

function moTooltip(o, eqs) {
  const sit = window.MapaObrasCalc.SITUACOES[o.situacao];
  const linhas = [
    `<div style="font-weight:700;font-size:13px;margin-bottom:2px">${moEsc(o.client_name || o.building_name || o.id)}</div>`,
    o.client_name && o.building_name ? `<div style="font-size:12px;color:#475569;max-width:280px;white-space:normal">${moEsc(o.building_name)}</div>` : "",
    `<div style="font-size:12px;margin-top:4px;max-width:300px;white-space:normal">${moEsc(window.MapaObrasCalc.enderecoTexto(o) || "Endereço não informado")}</div>`,
    `<div style="font-size:11px;color:#64748b">${moEsc(o.id)}${o.numero_cotacao ? " · Cotação Nº " + moEsc(o.numero_cotacao) : ""} · ${o.pos ? (o.pos.precisao === "cep" ? "posição pelo CEP" : "posição pelo endereço") : "posição aproximada (centro da cidade)"}</div>`,
    `<div style="margin-top:6px"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${sit.cor};margin-right:6px"></span><b>${moEsc(sit.rotulo)}</b></div>`,
  ];
  if (o.situacao === "andamento") {
    linhas.push(`<div style="font-size:12px;margin-top:4px">Status da obra: <b>${moEsc(o.status_master)}</b></div>`);
    linhas.push(`<div style="font-size:12px">Instalando: <b>${moEsc(o.instaladores.length ? o.instaladores.join(", ") : "instalador não informado")}</b></div>`);
    linhas.push(`<div style="font-size:12px">Equipamento na obra: ${o.equipamento_entregue ? "sim" + (o.equipamento_entregue_em ? " (" + moData(o.equipamento_entregue_em) + ")" : "") : "não informado"}</div>`);
    linhas.push(`<div style="font-size:12px">Vistorias concluídas: ${o.vistorias}</div>`);
  } else if (o.situacao === "aguardando") {
    linhas.push(`<div style="font-size:12px;margin-top:4px">Fase: <b>${moEsc(o.status_master)}</b></div>`);
  } else {
    linhas.push(`<div style="font-size:12px;margin-top:4px">Fase: <b>${moEsc(o.status_master)}</b>${o.instaladores.length ? " · Instalado por " + moEsc(o.instaladores.join(", ")) : ""}</div>`);
  }
  linhas.push(moEquipamentosHtml(eqs));
  linhas.push(`<div style="font-size:11px;color:#64748b;margin-top:6px">Clique para abrir o Dossiê da Obra</div>`);
  return linhas.join("");
}

function MapaObrasPage({ setRoute, setSubsel }) {
  const elRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const grpRef = React.useRef(null);
  const tileRef = React.useRef(null);
  const ajustouRef = React.useRef(false);
  const [estilo, setEstilo] = React.useState("claro");
  const [obras, setObras] = React.useState(null);
  const [erro, setErro] = React.useState(null);
  const [geo, setGeo] = React.useState(() => moLerCacheGeo());
  const [geocodificando, setGeocodificando] = React.useState(false);
  const [filtro, setFiltro] = React.useState({ andamento: true, concluida: true, aguardando: true });
  const [recarregar, setRecarregar] = React.useState(0);
  const [aba, setAba] = window.useRouteTab("mapa-obras", "mapa", ["mapa", "evolucao"]);
  const [foco, setFoco] = React.useState(null);
  const marcadoresRef = React.useRef({});
  /* Equipamentos e ocorrências (mesma carga da aba Evolução). */
  const evo = window.useEvolucaoItens(obras);
  const eqPorObra = React.useMemo(() => {
    const m = {};
    (evo.itens || []).forEach((it) => { (m[it.obra.id] = m[it.obra.id] || []).push(it); });
    return m;
  }, [evo.itens]);

  const abrirDossie = React.useCallback((id) => {
    if (setSubsel && setRoute) { setSubsel(id); setRoute("dossier-obra"); }
  }, [setRoute, setSubsel]);

  React.useEffect(() => {
    let vivo = true;
    const sb = (window.__VP_SB || {}).sb;
    if (!sb) { setErro("Banco de dados indisponível."); setObras([]); return undefined; }
    (async () => {
      try {
        const { data: dossies, error } = await sb.from("dossier_obra")
          .select("id, client_name, building_name, city, state, equip_type, status_master, numero_cotacao, equipamento_entregue, equipamento_entregue_em, parceiro_instalador_id, updated_at, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cep, latitude, longitude, geo_precisao");
        if (error) throw error;
        const lista = (dossies || [])
          .map((d) => ({ ...d, situacao: window.MapaObrasCalc.classificar(d) }))
          .filter((d) => d.situacao);
        const ids = lista.map((d) => d.id);
        const [vin, vis] = ids.length ? await Promise.all([
          sb.from("dossier_obra_instaladores").select("dossier_id, parceiro_instalador_id").in("dossier_id", ids),
          sb.from("vistorias_atividades").select("dossier_id, status").in("dossier_id", ids),
        ]) : [{ data: [] }, { data: [] }];
        const parceiroIds = new Set(lista.map((d) => d.parceiro_instalador_id).filter(Boolean));
        ((vin && vin.data) || []).forEach((v) => v.parceiro_instalador_id && parceiroIds.add(v.parceiro_instalador_id));
        let nomes = {};
        if (parceiroIds.size) {
          const { data: parc } = await sb.from("parceiros_instaladores").select("id, nome").in("id", Array.from(parceiroIds));
          (parc || []).forEach((p) => { nomes[p.id] = p.nome; });
        }
        const vistorias = {};
        ((vis && vis.data) || []).forEach((v) => { if (v.status === "concluida") vistorias[v.dossier_id] = (vistorias[v.dossier_id] || 0) + 1; });
        const extras = {};
        ((vin && vin.data) || []).forEach((v) => { (extras[v.dossier_id] = extras[v.dossier_id] || []).push(v.parceiro_instalador_id); });
        const final = lista.map((d) => {
          const insts = [d.parceiro_instalador_id, ...(extras[d.id] || [])].filter(Boolean).map((id) => nomes[id]).filter(Boolean);
          return { ...d, instaladores: Array.from(new Set(insts)), vistorias: vistorias[d.id] || 0, chave: window.MapaObrasCalc.chaveCidade(d.city, d.state), pos: window.MapaObrasCalc.posicaoGravada(d) };
        });
        if (vivo) { setObras(final); setErro(null); }
      } catch (e) {
        if (vivo) { setErro("Não foi possível carregar as obras: " + (e.message || e)); setObras([]); }
      }
    })();
    return () => { vivo = false; };
  }, [recarregar]);

  /* 1º as cidades que ainda não estão guardadas no navegador (centro da cidade, para quem
     não tem endereço); depois o endereço completo das obras que ainda não têm posição,
     gravando a posição no próprio dossiê (uma vez só). Tudo em fila: o Nominatim pede
     no máximo 1 consulta por segundo. */
  const tentouEndRef = React.useRef(new Set());
  React.useEffect(() => {
    if (!obras || !obras.length) return undefined;
    const vistas = new Map();
    obras.forEach((o) => { if (o.chave && !vistas.has(o.chave)) vistas.set(o.chave, { chave: o.chave, cidade: o.city, uf: o.state }); });
    const cidades = Array.from(vistas.values());
    const faltaCidade = cidades.some((c) => !(c.chave in moLerCacheGeo()));
    const semPos = obras.filter((o) => !o.pos && !tentouEndRef.current.has(o.id) && window.MapaObrasCalc.consultasGeocode(o).length);
    if (!faltaCidade && !semPos.length) return undefined;
    let vivo = true;
    setGeocodificando(true);
    (async () => {
      const cache = faltaCidade ? await moGeocodificarCidades(cidades, (c) => { if (vivo) setGeo(c); }) : moLerCacheGeo();
      for (const o of semPos) {
        if (!vivo) return;
        tentouEndRef.current.add(o.id);
        await new Promise((res) => setTimeout(res, 1100));
        const achou = await moGeocodificarEndereco(o, cache[o.chave]);
        if (achou && vivo) {
          setObras((lista) => (lista || []).map((x) => (x.id === o.id ? { ...x, pos: achou } : x)));
          try {
            if (window.__DOSSIER && window.__DOSSIER.salvarPosicao) await window.__DOSSIER.salvarPosicao(o.id, achou.lat, achou.lon, achou.precisao);
          } catch (e) { console.warn("[MapaObras] posição não gravada no dossiê", o.id, e); }
        }
      }
    })().finally(() => { if (vivo) setGeocodificando(false); });
    return () => { vivo = false; };
  }, [obras]);

  React.useEffect(() => {
    if (!window.L || !elRef.current) return undefined;
    const map = window.L.map(elRef.current, { zoomControl: true });
    mapRef.current = map;
    grpRef.current = window.L.layerGroup().addTo(map);
    map.setView([-15.8, -47.9], 4);
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => { clearTimeout(t); map.remove(); mapRef.current = null; };
  }, []);

  React.useEffect(() => {
    const map = mapRef.current; if (!map || !window.L) return;
    const cfg = MO_MAP_STYLES.find((s) => s.key === estilo) || MO_MAP_STYLES[0];
    if (tileRef.current) map.removeLayer(tileRef.current);
    tileRef.current = window.L.tileLayer(cfg.url, { attribution: cfg.attribution, subdomains: cfg.subdomains || "abc", maxZoom: 19 }).addTo(map);
    tileRef.current.bringToBack();
  }, [estilo]);

  const visiveis = React.useMemo(() => (obras || []).filter((o) => filtro[o.situacao]), [obras, filtro]);

  React.useEffect(() => {
    const map = mapRef.current, grp = grpRef.current; if (!map || !grp || !window.L) return;
    grp.clearLayers();
    marcadoresRef.current = {};
    /* Agrupa por ponto: posição do endereço (arredondada) ou centro da cidade; obras no mesmo ponto ficam lado a lado. */
    const grupos = new Map();
    visiveis.forEach((o) => {
      let chave = null, centro = null;
      if (o.pos) { chave = "p:" + o.pos.lat.toFixed(4) + "," + o.pos.lon.toFixed(4); centro = o.pos; }
      else if (o.chave && geo[o.chave]) { chave = "c:" + o.chave; centro = geo[o.chave]; }
      if (!chave) return;
      if (!grupos.has(chave)) grupos.set(chave, { centro, lista: [] });
      grupos.get(chave).lista.push(o);
    });
    const pontos = [];
    grupos.forEach(({ centro, lista }) => {
      lista.forEach((o, i) => {
        const pos = window.MapaObrasCalc.espalhar(centro, i, lista.length);
        if (!pos) return;
        pontos.push(pos);
        const cor = window.MapaObrasCalc.SITUACOES[o.situacao].cor;
        const eqs = eqPorObra[o.id] || [];
        const alerta = eqs.some((it) => it.linha.atrasada || (it.oc && it.oc.lista.some((x) => x.gravidade === "alta")));
        const anel = alerta ? "0 0 0 3px #dc2626," : "";
        const icone = window.L.divIcon({ className: "", html: `<div style="width:16px;height:16px;border-radius:50%;background:${cor};border:2px solid #fff;box-shadow:${anel}0 0 0 1px rgba(0,0,0,.35),0 1px 3px rgba(0,0,0,.4);cursor:pointer"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
        marcadoresRef.current[o.id] = window.L.marker(pos, { icon: icone, zIndexOffset: o.situacao === "andamento" ? 1000 : 0 })
          .addTo(grp)
          .bindTooltip(moTooltip(o, eqs), { direction: "top", offset: [0, -8], opacity: 1 })
          .on("click", () => abrirDossie(o.id));
      });
    });
    if (pontos.length && !ajustouRef.current) {
      map.fitBounds(window.L.latLngBounds(pontos), { padding: [40, 40], maxZoom: 11 });
      if (!geocodificando) ajustouRef.current = true;
    }
  }, [visiveis, geo, geocodificando, abrirDossie, eqPorObra]);

  /* Aba visível de novo: o Leaflet precisa recalcular o tamanho (estava escondido). "Ver no mapa" da
     Evolução centraliza o ponto da obra e abre o balão. */
  React.useEffect(() => {
    if (aba !== "mapa") return undefined;
    const map = mapRef.current; if (!map) return undefined;
    const t = setTimeout(() => {
      map.invalidateSize();
      if (!foco) return;
      const mk = marcadoresRef.current[foco];
      if (elRef.current && elRef.current.scrollIntoView) elRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
      if (mk) { ajustouRef.current = true; map.setView(mk.getLatLng(), 15); mk.openTooltip(); }
      else window.toast && window.toast("Esta obra ainda não tem posição no mapa (falta endereço ou cidade).", "warning");
      setFoco(null);
    }, 120);
    return () => clearTimeout(t);
  }, [aba, foco, visiveis, geo]);

  const verNoMapa = (id) => {
    const o = (obras || []).find((x) => x.id === id);
    if (o && !filtro[o.situacao]) setFiltro((f) => ({ ...f, [o.situacao]: true }));
    setFoco(id); setAba("mapa");
  };

  const contagem = (s) => (obras || []).filter((o) => o.situacao === s).length;
  const semLocal = (obras || []).filter((o) => !o.pos && (!o.chave || geo[o.chave] === null));
  const semEndereco = (obras || []).filter((o) => !o.pos).length;
  const S = (window.MapaObrasCalc || {}).SITUACOES || {};

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Obras & Instalação · Mapa</div>
          <h1 className="page-head__title">Mapa de Obras</h1>
          <p className="page-head__sub">{aba === "evolucao"
            ? "A linha do tempo de cada equipamento: os que já foram entregues, os que estão sendo instalados e os que ainda vão chegar na obra."
            : "Onde a VerticalParts está instalando, onde já concluiu e onde aguarda os equipamentos. Passe o mouse sobre um ponto para ver a obra; clique para abrir o dossiê."}</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="refresh" onClick={() => { ajustouRef.current = false; setObras(null); setRecarregar((n) => n + 1); }}>Atualizar</Button>
        </div>
      </div>

      <div className="tbar" style={{ marginBottom: 14 }}>
        <div className="seg">
          <button type="button" className={aba === "mapa" ? "is-active" : ""} onClick={() => setAba("mapa")}>Mapa</button>
          <button type="button" className={aba === "evolucao" ? "is-active" : ""} onClick={() => setAba("evolucao")}>Evolução dos equipamentos</button>
        </div>
      </div>

      {aba === "evolucao" && window.EvolucaoEquipamentos && (
        <window.EvolucaoEquipamentos obras={obras} dados={evo} onAbrirDossie={abrirDossie} onVerNoMapa={verNoMapa}/>
      )}

      <div style={{ display: aba === "mapa" ? "block" : "none" }}>
      <div className="grid-3" style={{ marginBottom: 16 }}>
        {["andamento", "concluida", "aguardando"].map((s) => (
          <KPI key={s} label={S[s] ? S[s].rotulo : s} value={obras ? String(contagem(s)) : "…"}
            sub={(evo.carregado ? `${(evo.itens || []).filter((it) => it.obra.situacao === s).length} equipamento(s) · ` : "") + (filtro[s] ? "no mapa — clique para ocultar" : "oculto — clique para mostrar")}
            onClick={() => setFiltro((f) => ({ ...f, [s]: !f[s] }))}
            style={{ boxShadow: filtro[s] ? `inset 4px 0 0 ${S[s] && S[s].cor}` : "none", opacity: filtro[s] ? 1 : 0.55 }}/>
        ))}
      </div>

      {erro && <div style={{ padding: 12, marginBottom: 12, border: "1px solid var(--vp-danger)", color: "var(--vp-danger)", borderRadius: 6, fontSize: 13 }}>{erro}</div>}

      <Card sharp>
        <div className="row sb" style={{ marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div className="row" style={{ gap: 14, fontSize: 12, flexWrap: "wrap" }}>
            {Object.keys(S).map((k) => (
              <span key={k} className="row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: S[k].cor, display: "inline-block" }}/>{S[k].rotulo}</span>
            ))}
            <span className="row" style={{ gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff", boxShadow: "0 0 0 3px #dc2626", display: "inline-block" }}/>Contorno vermelho: previsão vencida ou ocorrência grave</span>
            {geocodificando && <span style={{ color: "var(--fg3)" }}>Localizando endereços no mapa…</span>}
          </div>
          <div className="row" style={{ gap: 4 }}>
            {MO_MAP_STYLES.map((s) => (
              <button key={s.key} type="button" className={"btn btn--sm " + (estilo === s.key ? "btn--primary" : "btn--outline")} onClick={() => setEstilo(s.key)}>{s.label}</button>
            ))}
          </div>
        </div>
        {!window.L && <div style={{ padding: 24, color: "var(--fg3)", fontSize: 13 }}>O componente de mapa não carregou. Recarregue a página.</div>}
        <div ref={elRef} style={{ height: "min(68vh, 640px)", minHeight: 380, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}/>
        {obras === null && <div style={{ fontSize: 12, color: "var(--fg3)", marginTop: 8 }}>Carregando obras…</div>}
        <div style={{ fontSize: 11, color: "var(--fg3)", marginTop: 8 }}>
          A posição vem do endereço completo gravado no Dossiê da Obra. {semEndereco > 0 && `${semEndereco} obra(s) ainda sem endereço localizado aparecem no centro da cidade — preencha o endereço no Dossiê (botão "Editar endereço").`}
          {semLocal.length > 0 && ` ${semLocal.length} obra(s) sem cidade localizada não aparecem no mapa: ${semLocal.slice(0, 6).map((o) => o.id).join(", ")}${semLocal.length > 6 ? "…" : ""}.`}
        </div>
      </Card>
      </div>
    </div>
  );
}

window.MapaObrasPage = MapaObrasPage;
