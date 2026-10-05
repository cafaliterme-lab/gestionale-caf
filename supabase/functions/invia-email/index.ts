// Invia un'e-mail dal programma con la casella Aruba del CAF (SMTP SSL, porta 465).
// La password NON e' nel codice: sta nei "Secrets" delle Edge Functions di Supabase
//   SMTP_PASS (obbligatoria) · SMTP_USER (predefinito aliterme@cafcislsicilia.com) · SMTP_HOST (predefinito smtps.aruba.it)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
const MITTENTE = Deno.env.get("SMTP_USER") || "aliterme@cafcislsicilia.com"
const HOST = Deno.env.get("SMTP_HOST") || "smtps.aruba.it"
const PASSWORD = Deno.env.get("SMTP_PASS") || ""

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
}
function risposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } })
}
const emailValida = (e: string) => /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i.test(e)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    const auth = req.headers.get("Authorization") || ""
    if (!auth.startsWith("Bearer ")) return risposta({ error: "Accesso scaduto: esci e rientra nel programma" }, 401)
    const { data: { user }, error } = await supabase.auth.getUser(auth.slice(7))
    if (error || !user) return risposta({ error: "Accesso scaduto: esci e rientra nel programma" }, 401)
    const { data: profilo } = await supabase.from("profili").select("nome, sola_lettura").eq("id", user.id).single()
    if (!profilo) return risposta({ error: "Utente non abilitato" }, 403)

    // GET: dice solo se l'invio e' configurato
    if (req.method === "GET") return risposta({ configurato: !!PASSWORD, mittente: MITTENTE })
    if (req.method !== "POST") return risposta({ error: "Metodo non permesso" }, 405)
    if (profilo.sola_lettura) return risposta({ error: "Il tuo utente è in sola consultazione: non può inviare e-mail" }, 403)
    if (!PASSWORD) return risposta({ error: "Invio e-mail non ancora configurato: manca la password della casella del CAF (chiedi all'amministratore)" }, 503)

    const { a, oggetto, testo, html } = await req.json()
    const dest = String(a || "").trim().toLowerCase()
    if (!emailValida(dest)) return risposta({ error: "Indirizzo del destinatario non valido" }, 400)
    if (!String(oggetto || "").trim() || !String(testo || "").trim()) return risposta({ error: "Mancano oggetto o testo" }, 400)

    const client = new SMTPClient({ connection: { hostname: HOST, port: 465, tls: true, auth: { username: MITTENTE, password: PASSWORD } } })
    try {
      await client.send({
        from: "CAF CISL Alì Terme <" + MITTENTE + ">",
        to: dest,
        replyTo: MITTENTE,
        subject: String(oggetto).slice(0, 200),
        content: String(testo).slice(0, 50000),
        html: html ? String(html).slice(0, 300000) : undefined,
      })
    } finally {
      try { await client.close() } catch (_) { /* gia' chiusa */ }
    }
    return risposta({ ok: true, a: dest, da: profilo.nome })
  } catch (e) {
    const m = String((e as Error)?.message || e)
    if (/535|auth|credential|password/i.test(m)) return risposta({ error: "Aruba ha rifiutato l'accesso: la password della casella del CAF non è corretta" }, 502)
    return risposta({ error: "Invio non riuscito: " + m }, 500)
  }
})
