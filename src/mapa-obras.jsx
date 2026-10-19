/* ============================================================
   mapa-obras.jsx — Mapa de Obras (Obras & Instalação, 19/10/2026).
   Mesma engenharia do mapa do Rastreio Marítimo (Leaflet + trocador de
   estilo Claro/Escuro/Ruas/Satélite). Um ponto por dossiê de obra:
   em andamento (amarelo), concluída (verde), aguardando equipamentos (azul).
   Passar o mouse mostra a obra; em andamento mostra também o status e quem
   está instalando. Clique abre o Dossiê da Obra. Só leitura.
   Posição = centro da cidade da obra (Nominatim/OpenStreetMap, guardado no
   navegador) — o dossiê não tem endereço completo nem coordenada.
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

function moTooltip(o) {
  const sit = window.MapaObrasCalc.SITUACOES[o.situacao];
  const linhas = [
    `<div style="font-weight:700;font-size:13px;margin-bottom:2px">${moEsc(o.client_name || o.building_name || o.id)}</div>`,
    o.client_name && o.building_name ? `<div style="font-size:12px;color:#475569;max-width:280px;white-space:normal">${moEsc(o.building_name)}</div>` : "",
    `<div style="font-size:12px;margin-top:4px">${moEsc(String(o.city || "").trim())}${o.state ? "/" + moEsc(String(o.state).trim()) : ""} · ${moEsc(o.id)}${o.numero_cotacao ? " · Cotação Nº " + moEsc(o.numero_cotacao) : ""}</div>`,
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
          .select("id, client_name, building_name, city, state, equip_type, status_master, numero_cotacao, equipamento_entregue, equipamento_entregue_em, parceiro_instalador_id, updated_at");
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
          return { ...d, instaladores: Array.from(new Set(insts)), vistorias: vistorias[d.id] || 0, chave: window.MapaObrasCalc.chaveCidade(d.city, d.state) };
        });
        if (vivo) { setObras(final); setErro(null); }
      } catch (e) {
        if (vivo) { setErro("Não foi possível carregar as obras: " + (e.message || e)); setObras([]); }
      }
    })();
    return () => { vivo = false; };
  }, [recarregar]);

  /* Geocodifica as cidades que ainda não estão guardadas no navegador. */
  React.useEffect(() => {
    if (!obras || !obras.length) return undefined;
    const vistas = new Map();
    obras.forEach((o) => { if (o.chave && !vistas.has(o.chave)) vistas.set(o.chave, { chave: o.chave, cidade: o.city, uf: o.state }); });
    const cidades = Array.from(vistas.values());
    if (!cidades.some((c) => !(c.chave in moLerCacheGeo()))) return undefined;
    let vivo = true;
    setGeocodificando(true);
    moGeocodificarCidades(cidades, (c) => { if (vivo) setGeo(c); }).finally(() => { if (vivo) setGeocodificando(false); });
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
    const porCidade = new Map();
    visiveis.forEach((o) => { if (o.chave && geo[o.chave]) { if (!porCidade.has(o.chave)) porCidade.set(o.chave, []); porCidade.get(o.chave).push(o); } });
    const pontos = [];
    porCidade.forEach((lista, chave) => {
      lista.forEach((o, i) => {
        const pos = window.MapaObrasCalc.espalhar(geo[chave], i, lista.length);
        if (!pos) return;
        pontos.push(pos);
        const cor = window.MapaObrasCalc.SITUACOES[o.situacao].cor;
        const icone = window.L.divIcon({ className: "", html: `<div style="width:16px;height:16px;border-radius:50%;background:${cor};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.35),0 1px 3px rgba(0,0,0,.4);cursor:pointer"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
        window.L.marker(pos, { icon: icone, zIndexOffset: o.situacao === "andamento" ? 1000 : 0 })
          .addTo(grp)
          .bindTooltip(moTooltip(o), { direction: "top", offset: [0, -8], opacity: 1 })
          .on("click", () => abrirDossie(o.id));
      });
    });
    if (pontos.length && !ajustouRef.current) {
      map.fitBounds(window.L.latLngBounds(pontos), { padding: [40, 40], maxZoom: 11 });
      if (!geocodificando) ajustouRef.current = true;
    }
  }, [visiveis, geo, geocodificando, abrirDossie]);

  const contagem = (s) => (obras || []).filter((o) => o.situacao === s).length;
  const semLocal = (obras || []).filter((o) => !o.chave || geo[o.chave] === null);
  const S = (window.MapaObrasCalc || {}).SITUACOES || {};

  return (
    <div className="page fade-in">
      <div className="page-head">
        <div className="page-head__l">
          <div className="page-head__eyebrow"><span className="vp-rule"/>Obras & Instalação · Mapa</div>
          <h1 className="page-head__title">Mapa de Obras</h1>
          <p className="page-head__sub">Onde a VerticalParts está instalando, onde já concluiu e onde aguarda os equipamentos. Passe o mouse sobre um ponto para ver a obra; clique para abrir o dossiê.</p>
        </div>
        <div className="page-head__r">
          <Button variant="outline" icon="refresh" onClick={() => { ajustouRef.current = false; setObras(null); setRecarregar((n) => n + 1); }}>Atualizar</Button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        {["andamento", "concluida", "aguardando"].map((s) => (
          <KPI key={s} label={S[s] ? S[s].rotulo : s} value={obras ? String(contagem(s)) : "…"}
            sub={filtro[s] ? "no mapa — clique para ocultar" : "oculto — clique para mostrar"}
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
            {geocodificando && <span style={{ color: "var(--fg3)" }}>Localizando cidades no mapa…</span>}
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
          A posição é o centro da cidade da obra (o dossiê guarda só cidade e UF); obras da mesma cidade aparecem lado a lado.
          {semLocal.length > 0 && ` ${semLocal.length} obra(s) sem cidade localizada não aparecem no mapa: ${semLocal.slice(0, 6).map((o) => o.id).join(", ")}${semLocal.length > 6 ? "…" : ""}.`}
        </div>
      </Card>
    </div>
  );
}

window.MapaObrasPage = MapaObrasPage;
