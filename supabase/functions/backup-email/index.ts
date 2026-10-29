// 💾 Copia di sicurezza fuori dal programma: una volta a settimana l'ultimo backup automatico (tabella
// backup_automatici) parte compresso (.json.gz) per e-mail verso la casella del CAF, così esiste anche
// lontano dal database e dal PC dell'ufficio. Lo chiama ogni lunedì il cron di Vercel (vercel.json).
// Manda SOLO alla casella del CAF e al massimo una volta ogni 5 giorni (chi la chiama non può cambiare destinatario): così una copia mandata a mano
// di martedì non fa saltare quella automatica del lunedì dopo.
// Segreti: SMTP_PASS (lo stesso di invia-email) · SMTP2_* (casella di riserva, sotto) · SUPABASE_SERVICE_ROLE_KEY (automatico).
import nodemailer from "npm:nodemailer@6.9.16"
import { Buffer } from "node:buffer"

const URL_SB = Deno.env.get("SUPABASE_URL")!
const CHIAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const MITTENTE = Deno.env.get("SMTP_USER") || "aliterme@cafcislsicilia.com"
const HOST = Deno.env.get("SMTP_HOST") || "smtps.aruba.it"
const PASSWORD = Deno.env.get("SMTP_PASS") || ""
const GIORNI_TRA_INVII = 5
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

const H = { apikey: CHIAVE, Authorization: "Bearer " + CHIAVE, "Content-Type": "application/json" }
// il tasto del programma chiama la funzione dal browser: servono le intestazioni CORS (come invia-email)
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
}
function risposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } })
}
async function gzip(testo: string): Promise<Uint8Array> {
  const flusso = new Blob([testo]).stream().pipeThrough(new CompressionStream("gzip"))
  return new Uint8Array(await new Response(flusso).arrayBuffer())
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  try {
    if (!PASSWORD && !RISERVA.pass) return risposta({ error: "Manca SMTP_PASS" }, 503)
    // già mandato da poco: niente
    const imp = await fetch(URL_SB + "/rest/v1/impostazioni?select=valore&chiave=eq.backup_email_ultimo", { headers: H })
    const ultimo = imp.ok ? ((await imp.json())[0]?.valore || "") : ""
    if (ultimo && Date.now() - Date.parse(ultimo) < GIORNI_TRA_INVII * 86400000) return risposta({ ok: true, saltato: "già inviato il " + ultimo })
    // ultimo backup automatico
    const r = await fetch(URL_SB + "/rest/v1/backup_automatici?select=id,tipo,creato_il,dati&order=creato_il.desc&limit=1", { headers: H })
    const righe = r.ok ? await r.json() : []
    if (!Array.isArray(righe) || !righe.length) return risposta({ error: "Nessun backup trovato" }, 404)
    const b = righe[0]
    const giorno = String(b.creato_il).slice(0, 10)
    // stesso formato del file di backup del programma: si ripristina con «Importa backup» (datiCompleti = copia esatta di tutte le tabelle)
    const gz = await gzip(JSON.stringify({ versione: "email", esportatoIl: b.creato_il, pratiche: b.dati?.pratiche || [], datiCompleti: b.dati }))
    const conta = (k: string) => Array.isArray(b.dati?.[k]) ? b.dati[k].length : 0
    // va alla casella del CAF; se quella non funziona parte dalla riserva e arriva anche lì
    const esito = await mandaMail("Gestionale CAF CISL Alì Terme", {
      to: MITTENTE,
      subject: "💾 Copia di sicurezza settimanale del gestionale – " + giorno,
      text: "Copia di sicurezza automatica del gestionale del CAF CISL di Alì Terme (backup del " + giorno + ").\n\n"
        + "Pratiche: " + conta("pratiche") + " · Clienti: " + conta("clienti") + " · Versamenti: " + conta("versamenti") + "\n\n"
        + "Conserva questa e-mail: in caso di problemi il file allegato si ripristina dal programma (Utenti e permessi → Importa Backup: scegli il file .json.gz così com'è).\n"
        + "Contiene i dati dei clienti: non inoltrarla. Le copie più vecchie di qualche mese si possono cancellare.",
      attachments: [{ filename: "backup-gestionale-caf-" + giorno + ".json.gz", content: Buffer.from(gz), contentType: "application/gzip" }],
    }, true)
    const ora = new Date().toISOString()
    await fetch(URL_SB + "/rest/v1/impostazioni?on_conflict=chiave", { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ chiave: "backup_email_ultimo", valore: ora, aggiornato_il: ora }]) })
    return risposta({ ok: true, inviato: ora, backup: b.id, byte: gz.length, riserva: esito.riserva })
  } catch (e) {
    return risposta({ error: String((e as Error)?.message || e) }, 500)
  }
})
