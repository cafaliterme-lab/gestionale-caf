// Invia un'e-mail dal programma con la casella Aruba del CAF (SMTP SSL, porta 465).
// La password NON e' nel codice: sta nei "Secrets" delle Edge Functions di Supabase
//   SMTP_PASS (obbligatoria) · SMTP_USER (predefinito aliterme@cafcislsicilia.com) · SMTP_HOST (predefinito smtps.aruba.it)
// Se la casella del CAF non funziona, l'e-mail parte dalla casella di riserva (SMTP2_*, sotto) e la risposta lo dice (riserva: true).
// Versione leggera: nodemailer (al posto di denomailer, che superava il limite di CPU) e niente supabase-js.
import nodemailer from "npm:nodemailer@6.9.16"

const URL_SB = Deno.env.get("SUPABASE_URL")!
const CHIAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const MITTENTE = Deno.env.get("SMTP_USER") || "aliterme@cafcislsicilia.com"
const HOST = Deno.env.get("SMTP_HOST") || "smtps.aruba.it"
const PASSWORD = Deno.env.get("SMTP_PASS") || ""
// Casella di riserva (TIM): se quella del CAF non funziona (password rifiutata, server giù) si riprova da qui.
// Segreti: SMTP2_PASS (senza, la riserva non si usa) · SMTP2_USER · SMTP2_HOST · SMTP2_PORT (predefiniti per TIM: smtp.tim.it, 587 STARTTLS)
const RISERVA = { user: Deno.env.get("SMTP2_USER") || "cafcislaliterme@tim.it", host: Deno.env.get("SMTP2_HOST") || "smtp.tim.it", port: Number(Deno.env.get("SMTP2_PORT") || 587), pass: Deno.env.get("SMTP2_PASS") || "" }
const ATTESE = { connectionTimeout: 15000, greetingTimeout: 10000, socketTimeout: 30000 }
function trasportoCaf() { return nodemailer.createTransport({ host: HOST, port: 465, secure: true, auth: { user: MITTENTE, pass: PASSWORD }, ...ATTESE }) }
function trasportoRiserva() { return nodemailer.createTransport({ host: RISERVA.host, port: RISERVA.port, secure: RISERVA.port === 465, requireTLS: RISERVA.port !== 465, auth: { user: RISERVA.user, pass: RISERVA.pass }, ...ATTESE }) }
// manda dalla casella del CAF; se non riesce riprova dalla casella di riserva (le risposte vanno alla riserva).
// anchePerRiserva: dalla riserva l'e-mail va anche alla casella di riserva stessa (la copia di sicurezza arriva comunque)
async function mandaMail(nome: string, m: Record<string, unknown>, anchePerRiserva = false) {
  let erroreCaf = ""
  if (PASSWORD) {
    try { await trasportoCaf().sendMail({ ...m, from: nome + " <" + MITTENTE + ">" }); return { riserva: false, erroreCaf } }
    catch (e) { erroreCaf = String((e as Error)?.message || e); if (!RISERVA.pass) throw e }
  } else if (!RISERVA.pass) throw new Error("Manca la password della casella")
  await trasportoRiserva().sendMail({ ...m, from: nome + " <" + RISERVA.user + ">", replyTo: RISERVA.user, ...(anchePerRiserva ? { to: [String(m.to), RISERVA.user] } : {}) })
  return { riserva: true, erroreCaf }
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
}
function risposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } })
}
const emailValida = (e: string) => /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i.test(e)

// utente collegato (dal suo token) e il suo profilo
async function profiloDa(token: string) {
  const u = await fetch(URL_SB + "/auth/v1/user", { headers: { apikey: CHIAVE, Authorization: "Bearer " + token } })
  if (!u.ok) return null
  const user = await u.json()
  if (!user?.id) return null
  const p = await fetch(URL_SB + "/rest/v1/profili?select=nome,ruolo,sola_lettura&id=eq." + user.id, { headers: { apikey: CHIAVE, Authorization: "Bearer " + CHIAVE } })
  const righe = p.ok ? await p.json() : []
  return Array.isArray(righe) && righe.length ? righe[0] : null
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    const auth = req.headers.get("Authorization") || ""
    if (!auth.startsWith("Bearer ")) return risposta({ error: "Accesso scaduto: esci e rientra nel programma" }, 401)
    const profilo = await profiloDa(auth.slice(7))
    if (!profilo) return risposta({ error: "Accesso scaduto o utente non abilitato: esci e rientra nel programma" }, 401)

    // GET: dice solo se l'invio e' configurato
    if (req.method === "GET") return risposta({ configurato: !!PASSWORD || !!RISERVA.pass, mittente: MITTENTE, riserva: RISERVA.pass ? RISERVA.user : "" })
    if (req.method !== "POST") return risposta({ error: "Metodo non permesso" }, 405)
    if (profilo.sola_lettura) return risposta({ error: "Il tuo utente è in sola consultazione: non può inviare e-mail" }, 403)
    if (!PASSWORD && !RISERVA.pass) return risposta({ error: "Invio e-mail non ancora configurato: manca la password della casella del CAF (chiedi all'amministratore)" }, 503)

    const corpo = await req.json()
    // 🧪 prova della casella di riserva (solo amministratore): un'e-mail dalla riserva a se stessa
    if (corpo.provaRiserva) {
      if (profilo.ruolo !== "admin") return risposta({ error: "Solo l'amministratore può provare la casella di riserva" }, 403)
      if (!RISERVA.pass) return risposta({ error: "La casella di riserva non è ancora configurata: manca la sua password (segreto SMTP2_PASS in Supabase)" }, 503)
      await trasportoRiserva().sendMail({ from: "CAF CISL Alì Terme <" + RISERVA.user + ">", to: RISERVA.user, subject: "Prova della casella di riserva del gestionale", text: "Se leggi questa e-mail, la casella di riserva funziona: se quella del CAF non va, il programma manda da qui." })
      return risposta({ ok: true, riserva: true, mittente: RISERVA.user })
    }
    const { a, oggetto, testo, html } = corpo
    const dest = String(a || "").trim().toLowerCase()
    if (!emailValida(dest)) return risposta({ error: "Indirizzo del destinatario non valido" }, 400)
    if (!String(oggetto || "").trim() || !String(testo || "").trim()) return risposta({ error: "Mancano oggetto o testo" }, 400)

    const esito = await mandaMail("CAF CISL Alì Terme", {
      to: dest,
      replyTo: MITTENTE,
      subject: String(oggetto).slice(0, 200),
      text: String(testo).slice(0, 50000),
      html: html ? String(html).slice(0, 300000) : undefined,
    })
    return risposta({ ok: true, a: dest, da: profilo.nome, riserva: esito.riserva, mittente: esito.riserva ? RISERVA.user : MITTENTE })
  } catch (e) {
    const m = String((e as Error)?.message || e)
    if (/535|EAUTH|auth|credential|password/i.test(m)) return risposta({ error: RISERVA.pass ? "Né la casella del CAF né quella di riserva accettano la password: controllale" : "Aruba ha rifiutato l'accesso: la password della casella del CAF non è corretta" }, 502)
    return risposta({ error: "Invio non riuscito: " + m }, 500)
  }
})
