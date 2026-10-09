import postgres from 'npm:postgres@3.4.4'

// Porta de entrada do vpsistema no VP HUB (árvore de alçadas, Gelson 09/10/2026).
// • Autenticação: header x-sync-secret, conferido PERGUNTANDO ao vpsistema
//   (rpc verify_hub_sync_secret) — a senha vive só no cofre do vpsistema.
// • Gravação: conexão interna do banco do HUB (SUPABASE_DB_URL) — não usa
//   chave de API (as legadas do HUB foram desligadas em 28/09/2026).
// Ações: set_alcadas → vpsistema_set_alcadas ; set_email → vpsistema_set_email ;
//        set_valores → vpsistema_set_valores (quem vê R$).

const VPSISTEMA_URL = 'https://ubdkoqxfwcraftesgmbw.supabase.co'
// Chave PÚBLICA (anon) do vpsistema — a mesma que está no site; só chama o verificador.
const VPSISTEMA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InViZGtvcXhmd2NyYWZ0ZXNnbWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNjUwMjcsImV4cCI6MjA5MDY0MTAyN30.s1A15nFQVne94gbz0511L2IYvHdTcgYeL0H8YU80iI8'

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

async function secretOk(secret: string | null) {
  if (!secret || secret.length < 32) return false
  const r = await fetch(`${VPSISTEMA_URL}/rest/v1/rpc/verify_hub_sync_secret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: VPSISTEMA_ANON, Authorization: `Bearer ${VPSISTEMA_ANON}` },
    body: JSON.stringify({ p_secret: secret }),
  })
  return r.ok && (await r.json()) === true
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'método não permitido' }, 405)
  try {
    if (!(await secretOk(req.headers.get('x-sync-secret')))) return json({ error: 'não autorizado' }, 401)
    const dbUrl = Deno.env.get('SUPABASE_DB_URL')
    if (!dbUrl) return json({ error: 'SUPABASE_DB_URL ausente' }, 500)
    const body = await req.json()
    const sql = postgres(dbUrl, { prepare: false, max: 1 })
    try {
      if (body.action === 'set_alcadas') {
        const [row] = await sql`select public.vpsistema_set_alcadas(${body.p_email}, ${body.p_caps ?? []}::text[], ${body.p_modulos ?? []}::text[]) as r`
        return json(row.r)
      }
      if (body.action === 'set_email') {
        const [row] = await sql`select public.vpsistema_set_email(${body.p_old}, ${body.p_new}) as r`
        return json(row.r)
      }
      if (body.action === 'set_valores') {
        const [row] = await sql`select public.vpsistema_set_valores(${body.p_email}, ${body.p_modo}, ${body.p_liberar ?? []}::text[], ${body.p_esconder ?? []}::text[]) as r`
        return json(row.r)
      }
      return json({ error: 'ação desconhecida' }, 400)
    } finally {
      await sql.end({ timeout: 2 })
    }
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
