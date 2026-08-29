// ============================================================
// ais-sync — Sincronização de posição dos embarques (Fase 2 / AIS)
// ------------------------------------------------------------
// Backend do spec de Importação: "Calcula progresso, status, ETA dinâmico"
//
// Três modos, escolhidos automaticamente por embarque:
//   • SINAY REAL → quando o secret SINAY_API_KEY existe E o embarque tem
//                  bl ou container_number preenchido. Consulta a Sinay/
//                  Safecube Container Tracking API (rastreio real, por
//                  BL/container/booking) e persiste posição, ETA e status.
//   • AIS GENÉRICO → sem BL/container mas com IMO + secrets AIS_API_KEY/
//                  AIS_PROVIDER_URL (integração antiga, mantida por
//                  compatibilidade).
//   • SIMULAÇÃO   → sem nenhuma chave, interpola a rota porto-origem →
//                  porto-destino (mantém o demo "vivo").
//
// Para ativar o rastreio real via Sinay, configure o secret:
//   supabase secrets set SINAY_API_KEY=...
// (ou via Dashboard → Project Settings → Edge Functions → Secrets)
// ============================================================
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
    if (!resp.ok) return { __error: `HTTP ${resp.status}` };
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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const hasSinay = !!Deno.env.get("SINAY_API_KEY");
  const hasGenericAis = !!Deno.env.get("AIS_API_KEY");

  const { data: ships, error } = await supabase
    .from("embarques").select("*").neq("status", "Entregue");

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: JSON_HEADERS,
    });
  }

  let updated = 0;
  let sinayCount = 0;
  const now = new Date().toISOString();

  for (const e of ships ?? []) {
    let patch: Record<string, unknown> = { last_ais_sync: now };
    let handled = false;

    // 1) Rastreio real via Sinay — precisa de BL ou nº do container.
    const shipmentNumber = e.bl || e.container_number;
    if (hasSinay && shipmentNumber) {
      const shipmentType = e.bl ? "BL" : "CT";
      const raw = await fetchSinay(shipmentNumber, shipmentType, e.sealine || null);
      await sleep(1100); // respeita o rate limit de 10 req/10s da Sinay

      if (raw && !raw.__rateLimited && !raw.__error) {
        const mapped = mapSinayResponse(raw);
        patch = {
          ...patch,
          tracking_provider: "sinay",
          tracking_status: mapped.shippingStatus,
          tracking_updated_at: mapped.sinayUpdatedAt || now,
          tracking_raw: raw,
        };
        if (mapped.lat != null && mapped.lng != null) {
          patch.lat = mapped.lat;
          patch.lng = mapped.lng;
        }
        if (mapped.eta) patch.eta = mapped.eta;
        if (mapped.etd) patch.etd = mapped.etd;
        if (mapped.vessel) patch.vessel = mapped.vessel;
        if (mapped.imo) patch.imo = mapped.imo;
        if (mapped.timeline && mapped.timeline.length) patch.tracking_events = mapped.timeline;
        handled = true;
      } else if (raw) {
        // Rate limit ou erro pontual — não sobrescreve dados já persistidos,
        // só registra a tentativa para não travar a fila de sincronização.
        patch.tracking_status = raw.__rateLimited ? "RATE_LIMITED" : "ERROR";
      }
    }

    // 2) Fallback: AIS genérico por IMO (integração antiga).
    if (!handled && hasGenericAis && e.imo) {
      const real = await fetchAis(e.imo);
      if (real && real.lat != null && real.lng != null) {
        patch = { ...patch, lat: real.lat, lng: real.lng, speed: real.speed, heading: real.heading };
        if (real.eta) patch.eta = real.eta;
        handled = true;
      }
    }

    // 3) Simulação — mantém o demo "vivo" quando não há integração real.
    if (!handled) {
      const start = portOf(e.origin, [31.2, 121.5]);
      const end = portOf(e.destination, [-23.95, -46.3]);
      const arrived = e.status === "Aguardando liberação" || (e.position ?? 0) >= 0.99;
      if (arrived) {
        patch = { ...patch, speed: 0 };
      } else {
        const pos = Math.min(0.99, (e.position ?? 0) + 0.02 + Math.random() * 0.015);
        const lat = start[0] + (end[0] - start[0]) * pos;
        const lng = start[1] + (end[1] - start[1]) * pos;
        const hdg = Math.round(((bearing(start, end) + (Math.random() * 6 - 3)) + 360) % 360);
        patch = {
          ...patch,
          position: Math.round(pos * 1000) / 1000,
          lat: Math.round(lat * 100) / 100,
          lng: Math.round(lng * 100) / 100,
          heading: hdg,
          speed: Math.round((14 + Math.random() * 4) * 10) / 10,
        };
      }
    } else {
      sinayCount++;
    }

    const { error: upErr } = await supabase.from("embarques").update(patch).eq("id", e.id);
    if (!upErr) updated++;
  }

  const mode = sinayCount > 0 ? "sinay" : hasGenericAis ? "ais" : "simulação";
  return new Response(JSON.stringify({ ok: true, mode, updated, sinayCount }), {
    headers: JSON_HEADERS,
  });
});
