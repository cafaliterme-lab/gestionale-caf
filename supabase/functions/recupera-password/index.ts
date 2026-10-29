// Recupero password dalla schermata di accesso (senza essere entrati nel programma).
// 1) { azione: "invia", email }            → manda per e-mail un codice di 6 cifre valido 15 minuti
// 2) { azione: "cambia", email, codice, password } → se il codice è giusto imposta la nuova password
// Il codice viene salvato solo come impronta (SHA-256); dopo 5 tentativi sbagliati non vale più.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// invio con nodemailer, come invia-email (denomailer superava il limite di CPU), con la casella di riserva
import nodemailer from "npm:nodemailer@6.9.16"

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)
const MITTENTE = Deno.env.get("SMTP_USER") || "aliterme@cafcislsicilia.com"
const HOST = Deno.env.get("SMTP_HOST") || "smtps.aruba.it"
const PASSWORD = Deno.env.get("SMTP_PASS") || ""
const MINUTI = 15
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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
}
function risposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } })
}
async function impronta(testo: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("")
}
async function trovaProfilo(email: string) {
  const { data } = await supabase.from("profili").select("id, nome, email").ilike("email", email).limit(1)
  return data && data[0] ? data[0] : null
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return risposta({ error: "Metodo non permesso" }, 405)
  try {
    const { azione, email, codice, password } = await req.json()
    const mail = String(email || "").trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(mail)) return risposta({ error: "Scrivi un indirizzo e-mail valido" }, 400)

    if (azione === "invia") {
      if (!PASSWORD && !RISERVA.pass) return risposta({ error: "Invio e-mail non configurato: chiedi all'amministratore di cambiarti la password" }, 503)
      const profilo = await trovaProfilo(mail)
      // Per non far capire quali e-mail esistono, la risposta è sempre la stessa
      if (!profilo) return risposta({ ok: true })
      // al massimo 3 codici ogni 15 minuti per utente
      const { count } = await supabase.from("recupero_password").select("id", { count: "exact", head: true })
        .eq("utente_id", profilo.id).gte("creato_il", new Date(Date.now() - MINUTI * 60000).toISOString())
      if ((count || 0) >= 3) return risposta({ error: "Hai già chiesto troppi codici: aspetta 15 minuti" }, 429)
      const cod = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0")
      await supabase.from("recupero_password").insert({ utente_id: profilo.id, codice_hash: await impronta(profilo.id + ":" + cod), scade: new Date(Date.now() + MINUTI * 60000).toISOString() })
      await mandaMail("CAF CISL Alì Terme", {
        to: profilo.email,
        subject: "Codice per cambiare la password del Protocollo CAF",
        text: "Ciao " + (profilo.nome || "") + ",\n\nil tuo codice per cambiare la password del programma Protocollo CAF CISL Alì Terme è:\n\n" + cod + "\n\nVale " + MINUTI + " minuti. Se non l'hai chiesto tu, ignora questa e-mail: la tua password resta quella di prima.\n\nCAF CISL Alì Terme",
        html: "<p>Ciao " + (profilo.nome || "") + ",</p><p>il tuo codice per cambiare la password del programma <b>Protocollo CAF CISL Alì Terme</b> è:</p><p style=\"font-size:28px; font-weight:bold; letter-spacing:6px\">" + cod + "</p><p>Vale " + MINUTI + " minuti. Se non l'hai chiesto tu, ignora questa e-mail: la tua password resta quella di prima.</p><p>CAF CISL Alì Terme</p>",
      })
      return risposta({ ok: true })
    }

    if (azione === "cambia") {
      const cod = String(codice || "").replace(/\D/g, "")
      const pwd = String(password || "")
      if (cod.length !== 6) return risposta({ error: "Il codice ha 6 cifre" }, 400)
      if (pwd.length < 6) return risposta({ error: "La nuova password deve avere almeno 6 caratteri" }, 400)
      const profilo = await trovaProfilo(mail)
      if (!profilo) return risposta({ error: "Codice non valido o scaduto" }, 400)
      const { data: righe } = await supabase.from("recupero_password").select("*")
        .eq("utente_id", profilo.id).eq("usato", false).gte("scade", new Date().toISOString())
        .order("creato_il", { ascending: false }).limit(1)
      const r = righe && righe[0]
      if (!r || r.tentativi >= 5) return risposta({ error: "Codice non valido o scaduto: chiedine uno nuovo" }, 400)
      if (r.codice_hash !== await impronta(profilo.id + ":" + cod)) {
        await supabase.from("recupero_password").update({ tentativi: r.tentativi + 1 }).eq("id", r.id)
        return risposta({ error: "Codice sbagliato (tentativi rimasti: " + (4 - r.tentativi) + ")" }, 400)
      }
      const { error } = await supabase.auth.admin.updateUserById(profilo.id, { password: pwd })
      if (error) return risposta({ error: "Password non cambiata: " + error.message }, 500)
      await supabase.from("recupero_password").update({ usato: true }).eq("utente_id", profilo.id).eq("usato", false)
      return risposta({ ok: true })
    }
    return risposta({ error: "Azione non valida" }, 400)
  } catch (e) {
    const m = String((e as Error)?.message || e)
    if (/535|auth|credential/i.test(m)) return risposta({ error: "Invio dell'e-mail non riuscito: chiedi all'amministratore di cambiarti la password" }, 502)
    return risposta({ error: "Operazione non riuscita: " + m }, 500)
  }
})
