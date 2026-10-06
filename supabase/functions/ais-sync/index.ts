// ============================================================
// ais-sync — Sincronização de posição dos embarques (Fase 2 / AIS)
// ------------------------------------------------------------
// Backend do spec de Importação: "Calcula progresso, status, ETA dinâmico"
//
// Modos, escolhidos automaticamente por embarque:
//   • SINAY REAL → secret SINAY_API_KEY + embarque com bl ou container_number.
//   • AIS GENÉRICO → sem BL/container mas com IMO + AIS_API_KEY/AIS_PROVIDER_URL.
//   • NUNCA SIMULA (06/10/2026): se a consulta falhar ou faltar dado, a última
//     posição real é mantida e o motivo vai em tracking_status/tracking_erro.
//     (Antes a função inventava avanço de ~2%/dia, velocidade e rumo.)
//
// Para ativar o rastreio real via Sinay, configure o secret:
//   supabase secrets set SINAY_API_KEY=...
// (ou via Dashboard → Project Settings → Edge Functions → Secrets)
// ============================================================

const SB_URL = Deno.env.get("SUPABASE_URL")!;
function sbKey(): string {
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")!)["default"]; }
  catch { return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; }
}
const pgH = () => ({ apikey: sbKey(), Authorization: `Bearer ${sbKey()}`, "Content-Type": "application/json" });

const PORTS: Record<string, [number, number]> = {
  shanghai: [31.2, 121.5], xangai: [31.2, 121.5],
  ningbo: [29.8, 121.5], qingdao: [36.0, 120.4],
  hamburg: [53.55, 9.99], hamburgo: [53.55, 9.99],
  santos: [-23.95, -46.3], itaguai: [-22.86, -43.75], "itaguaí": [-22.86, -43.75],
};

function portOf(s: string | null, fallback: [number, number]): [number, number] {
  if (!s) return fallback;
  const k = s.toLowerCase();
  for (const name in PORTS) if (k.includes(name)) return PORTS[name];
  return fallback;
}

function bearing(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const lat1 = toRad(a[0]), lat2 = toRad(b[0]);
  const dLon = toRad(b[1] - a[1]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Sinay / Safecube Container Tracking API ----------
// Docs: https://documentation.safecube.ai/reference/getting-started-with-container-tracking-api
// GET https://api.sinay.ai/container-tracking/api/v2/shipment
//   ?shipmentNumber=<BL|container|booking>&shipmentType=<BL|CT|BK>&sealine=<SCAC>
// Header: API_KEY: <chave>
// Rate limit: 10 req / 10s por chave — por isso os embarques são processados
// em série com um pequeno intervalo entre chamadas.
async function fetchSinay(
  shipmentNumber: string,
  shipmentType: "BL" | "CT",
  sealine: string | null,
): Promise<Record<string, unknown> | null> {
  const key = Deno.env.get("SINAY_API_KEY");
  if (!key) return null;
  const params = new URLSearchParams({ shipmentNumber, shipmentType });
  if (sealine) params.set("sealine", sealine);
  const url = `https://api.sinay.ai/container-tracking/api/v2/shipment?${params.toString()}`;
  try {
    const resp = await fetch(url, { headers: { API_KEY: key } });
    if (resp.status === 429) return { __rateLimited: true };
    if (!resp.ok) {
      let corpo = "";
      try { corpo = (await resp.text()).replace(/\s+/g, " ").slice(0, 160); } catch (_e) { /* ignora */ }
      return { __error: `HTTP ${resp.status}${corpo ? " — " + corpo : ""}` };
    }
    return await resp.json();
  } catch (e) {
    return { __error: String(e) };
  }
}

// Extrai {lat,lng,eta,etd,vessel,imo,status} de um response da Sinay.
function mapSinayResponse(j: Record<string, unknown>) {
  const metadata = (j.metadata ?? {}) as Record<string, unknown>;
  const route = (j.route ?? {}) as Record<string, unknown>;
  const pol = (route.pol ?? {}) as Record<string, unknown>;
  const pod = (route.pod ?? {}) as Record<string, unknown>;
  const vessels = (j.vessels ?? []) as Array<Record<string, unknown>>;
  const vessel = vessels[0];
  const containers = (j.containers ?? []) as Array<Record<string, unknown>>;
  const events = (containers[0]?.events ?? []) as Array<Record<string, unknown>>;

  const isoDate = (v: unknown) => (typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : null);
  const coordsOf = (loc: unknown) => (loc as Record<string, unknown> | undefined)?.coordinates as
    { lat?: number; lng?: number } | undefined;

  // A Sinay nem sempre devolve o bloco top-level "coordinates" (posição AIS
  // ao vivo do navio). Quando falta, usamos a localização do último evento
  // confirmado (isActual=true) como posição aproximada — melhor que nada.
  let coords = j.coordinates as { lat?: number; lng?: number } | undefined;
  if (!coords?.lat) {
    const lastActual = [...events].reverse().find((ev) => ev.isActual);
    coords = coordsOf(lastActual?.location) ?? coordsOf((pol as Record<string, unknown>)?.location);
  }

  // Linha do tempo de eventos reais (Container Arrival / Departure / Gate-In /
  // Gate-Out etc.) — mesmo dado que o Safecube exibe em "Linha Do Tempo De
  // Eventos". Mais recente primeiro, como o front espera renderizar.
  const timeline = events
    .map((ev) => ({
      date: (ev.eventDateTime as string) ?? (ev.date as string) ?? null,
      description: (ev.description as string) ?? (ev.eventCode as string) ?? null,
      location: ((ev.location as Record<string, unknown>)?.name as string) ?? null,
      vessel: ((ev.vessel as Record<string, unknown>)?.name as string) ?? null,
      isActual: !!ev.isActual,
    }))
    .filter((ev) => ev.date && ev.description)
    .sort((a, b) => (b.date as string).localeCompare(a.date as string));

  return {
    shippingStatus: (metadata.shippingStatus as string) ?? null,
    sinayUpdatedAt: (metadata.updatedAt as string) ?? null,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    eta: isoDate((pod as Record<string, unknown>)?.date),
    etd: isoDate((pol as Record<string, unknown>)?.date),
    vessel: (vessel?.name as string) ?? null,
    imo: vessel?.imo != null ? String(vessel.imo) : null,
    timeline,
  };
}

// Provider-agnostic legado: ajuste o mapeamento aos campos do seu provedor.
async function fetchAis(imo: string | null): Promise<Record<string, unknown> | null> {
  const key = Deno.env.get("AIS_API_KEY");
  const base = Deno.env.get("AIS_PROVIDER_URL"); // ex.: https://api.provider.com/vessel?imo={imo}
  if (!key || !base || !imo) return null;
  try {
    const url = base.replace("{imo}", encodeURIComponent(imo));
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!resp.ok) return null;
    const j = await resp.json();
    return {
      lat: j.lat ?? j.latitude ?? null,
      lng: j.lng ?? j.longitude ?? null,
      speed: j.speed ?? j.speed_kn ?? null,
      heading: j.heading ?? j.course ?? null,
      eta: j.eta ?? null,
    };
  } catch (_e) {
    return null;
  }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const JSON_HEADERS = { ...CORS, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const hasSinay = !!Deno.env.get("SINAY_API_KEY");
  const hasGenericAis = !!Deno.env.get("AIS_API_KEY");

  const r = await fetch(`${SB_URL}/rest/v1/embarques?select=*&status=neq.Entregue&teste=eq.false&chegada_confirmada_em=is.null`, { headers: pgH() });
  if (!r.ok) {
    return new Response(JSON.stringify({ ok: false, error: `HTTP ${r.status}` }), { status: 500, headers: JSON_HEADERS });
  }
  const ships = await r.json() as Array<Record<string, any>>;

  let updated = 0;
  let real = 0;
  const now = new Date().toISOString();

  for (const e of ships) {
    let patch: Record<string, unknown> = {};
    let handled = false;

    const shipmentNumber = e.bl || e.container_number;
    if (hasSinay && shipmentNumber) {
      const shipmentType = e.bl ? "BL" : "CT";
      const raw = await fetchSinay(shipmentNumber, shipmentType, e.sealine || null);
      await sleep(1100); // respeita o rate limit de 10 req/10s da Sinay

      if (raw && !raw.__rateLimited && !raw.__error) {
        const mapped = mapSinayResponse(raw);
        patch = {
          last_ais_sync: now,
          tracking_provider: "sinay",
          tracking_status: mapped.shippingStatus,
          tracking_erro: null,
          tracking_updated_at: mapped.sinayUpdatedAt || now,
          tracking_raw: raw,
        };
        if (mapped.lat != null && mapped.lng != null) {
          patch.lat = mapped.lat;
          patch.lng = mapped.lng;
          const start = portOf(e.origin, [31.2, 121.5]);
          const end = portOf(e.destination, [-23.95, -46.3]);
          const total = Math.hypot(end[0] - start[0], end[1] - start[1]);
          if (total > 0) patch.position = Math.round(Math.max(0, Math.min(0.99, Math.hypot(mapped.lat - start[0], mapped.lng - start[1]) / total)) * 1000) / 1000;
          patch.speed = null; patch.heading = null; // a Sinay não informa velocidade/rumo
        }
        if (mapped.eta) patch.eta = mapped.eta;
        if (mapped.etd) patch.etd = mapped.etd;
        if (mapped.vessel) patch.vessel = mapped.vessel;
        if (mapped.imo) patch.imo = mapped.imo;
        if (mapped.timeline && mapped.timeline.length) patch.tracking_events = mapped.timeline;
        handled = true;
      } else if (raw) {
        // Erro/limite: NÃO mexe na posição; só registra o motivo.
        patch = {
          tracking_status: raw.__rateLimited ? "RATE_LIMITED" : "ERROR",
          tracking_erro: raw.__rateLimited ? "HTTP 429 — limite de requisições da Sinay" : String(raw.__error ?? "erro desconhecido"),
        };
      }
    } else if (!shipmentNumber && !(hasGenericAis && e.imo)) {
      patch = { tracking_status: "SEM_IDENTIFICADOR", tracking_erro: "Embarque sem BL nem nº de container — nada a rastrear." };
    } else if (!hasSinay && shipmentNumber && !(hasGenericAis && e.imo)) {
      patch = { tracking_status: "ERROR", tracking_erro: "Secret SINAY_API_KEY não configurada no Supabase." };
    }

    if (!handled && hasGenericAis && e.imo && !shipmentNumber) {
      const ais = await fetchAis(e.imo);
      if (ais && ais.lat != null && ais.lng != null) {
        patch = { last_ais_sync: now, lat: ais.lat, lng: ais.lng, speed: ais.speed, heading: ais.heading, tracking_erro: null };
        if (ais.eta) patch.eta = ais.eta;
        handled = true;
      }
    }

    if (handled) real++;
    if (Object.keys(patch).length) {
      const u = await fetch(`${SB_URL}/rest/v1/embarques?id=eq.${encodeURIComponent(e.id)}`, {
        method: "PATCH", headers: { ...pgH(), Prefer: "return=minimal" }, body: JSON.stringify(patch),
      });
      if (u.ok) updated++;
    }
  }

  return new Response(JSON.stringify({ ok: true, mode: real > 0 ? "real" : "sem leitura real", updated, real }), {
    headers: JSON_HEADERS,
  });
});
