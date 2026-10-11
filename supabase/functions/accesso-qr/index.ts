// Accesso al programma su un PC inquadrando un QR con il telefono (come WhatsApp Web).
// 1) PC (senza accesso)      { azione: "crea", dispositivo }       → { id, codice, segreto, scade }
//    Il PC mostra un QR con il "codice"; il "segreto" lo tiene solo lui.
// 2) Telefono (gia' entrato o abilitato) { azione: "info", codice, telefono? }            → dispositivo che chiede l'accesso
//                            { azione: "approva", codice }         → il PC potra' entrare con l'utente del telefono
// 3) PC                      { azione: "stato", id, segreto }      → "attesa" | "scaduto" | "ok" (+ token per entrare)
// Il codice vale 3 minuti e si usa una volta sola; sul server restano solo le impronte (SHA-256) di codice e segreto.
const URL_SB = Deno.env.get("SUPABASE_URL")!
const CHIAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const SECONDI = 180

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
function casuale(n: number) {
  const b = crypto.getRandomValues(new Uint8Array(n))
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
const H = { apikey: CHIAVE, Authorization: "Bearer " + CHIAVE, "Content-Type": "application/json" }
async function rest(percorso: string, metodo = "GET", corpo?: unknown, prefer = "return=representation") {
  const r = await fetch(URL_SB + "/rest/v1/" + percorso, { method: metodo, headers: { ...H, Prefer: prefer }, body: corpo ? JSON.stringify(corpo) : undefined })
  const t = await r.text()
  let d: any = null
  try { d = t ? JSON.parse(t) : null } catch (_) { d = t }
  if (!r.ok) throw new Error((d && (d.message || d.msg)) || ("errore " + r.status))
  return d
}
// Utente del telefono: dal suo accesso (token) si ricava chi e'
async function utenteDaRichiesta(req: Request) {
  const tok = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "")
  if (!tok) return null
  const r = await fetch(URL_SB + "/auth/v1/user", { headers: { apikey: CHIAVE, Authorization: "Bearer " + tok } })
  if (!r.ok) return null
  const u = await r.json()
  return u && u.id ? u : null
}
async function rigaDaCodice(codice: string) {
  const righe = await rest("accessi_qr?select=*&codice_hash=eq." + (await impronta("c:" + codice)))
  return righe && righe[0] ? righe[0] : null
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST") return risposta({ error: "Metodo non permesso" }, 405)
  try {
    const b = await req.json()
    const azione = String(b.azione || "")
    const adesso = Date.now()

    if (azione === "crea") {
      // freno: al massimo 60 codici al minuto in tutto
      const recenti = await rest("accessi_qr?select=id&creato_il=gte." + new Date(adesso - 60000).toISOString())
      if (Array.isArray(recenti) && recenti.length >= 60) return risposta({ error: "Troppe richieste: riprova tra un minuto" }, 429)
      // pulizia dei codici vecchi (piu' di un giorno)
      rest("accessi_qr?creato_il=lt." + new Date(adesso - 86400000).toISOString(), "DELETE", undefined, "return=minimal").catch(() => {})
      const codice = casuale(18), segreto = casuale(32)
      const righe = await rest("accessi_qr", "POST", {
        codice_hash: await impronta("c:" + codice),
        segreto_hash: await impronta("s:" + segreto),
        dispositivo: String(b.dispositivo || "").slice(0, 120),
        scade_il: new Date(adesso + SECONDI * 1000).toISOString(),
      })
      return risposta({ id: righe[0].id, codice, segreto, scade: righe[0].scade_il, secondi: SECONDI })
    }

    // Telefono abilitato: resta "chiave" per far entrare i PC anche se nel programma si preme Esci
    if (azione === "registra_telefono") {
      const utente = await utenteDaRichiesta(req)
      if (!utente) return risposta({ error: "Accesso scaduto: entra di nuovo nel programma" }, 401)
      const segreto = casuale(32)
      const righe = await rest("telefoni_qr", "POST", { utente_id: utente.id, nome: String(b.nome || "").slice(0, 120), segreto_hash: await impronta("t:" + segreto) })
      return risposta({ id: righe[0].id, segreto })
    }

    if (azione === "info" || azione === "approva") {
      // chi approva: il telefono abilitato (chiave salvata sul telefono) oppure l'utente entrato nel programma
      let utenteId: string | null = null
      const tel = b.telefono || null
      if (tel && tel.id && tel.segreto) {
        const t = await rest("telefoni_qr?select=*&id=eq." + encodeURIComponent(String(tel.id)))
        const r = t && t[0]
        if (r && !r.revocato_il && r.segreto_hash === (await impronta("t:" + String(tel.segreto))) && Date.now() - new Date(r.creato_il).getTime() < 365 * 86400000) {
          utenteId = r.utente_id
          if (azione === "approva") rest("telefoni_qr?id=eq." + r.id, "PATCH", { ultimo_uso: new Date().toISOString() }, "return=minimal").catch(() => {})
        } else if (!b.conAccesso) {
          return risposta({ error: "telefono_non_valido" }, 401)
        }
      }
      if (!utenteId) {
        const utente = await utenteDaRichiesta(req)
        if (!utente) return risposta({ error: "Per far entrare un PC devi prima essere entrato nel programma su questo telefono" }, 401)
        utenteId = utente.id
      }
      const riga = await rigaDaCodice(String(b.codice || ""))
      if (!riga) return risposta({ error: "QR non valido: inquadra il QR che vedi adesso sul PC" }, 404)
      if (new Date(riga.scade_il).getTime() < adesso) return risposta({ error: "QR scaduto: inquadra di nuovo il QR che vedi adesso sul PC" }, 410)
      if (riga.approvato_il) return risposta({ error: "Questo QR è già stato usato" }, 409)
      const prof = await rest("profili?select=id,nome&id=eq." + utenteId)
      if (!prof || !prof[0]) return risposta({ error: "Utente non abilitato al programma" }, 403)
      if (azione === "info") return risposta({ dispositivo: riga.dispositivo || "PC", scade: riga.scade_il, nome: prof[0].nome || "" })
      const agg = await rest("accessi_qr?id=eq." + riga.id + "&approvato_il=is.null", "PATCH", { utente_id: utenteId, approvato_il: new Date().toISOString() })
      if (!agg || !agg.length) return risposta({ error: "Questo QR è già stato usato" }, 409)
      return risposta({ ok: true, nome: prof[0].nome || "", dispositivo: riga.dispositivo || "PC" })
    }

    if (azione === "stato") {
      const righe = await rest("accessi_qr?select=*&id=eq." + encodeURIComponent(String(b.id || "")))
      const riga = righe && righe[0]
      if (!riga || riga.segreto_hash !== (await impronta("s:" + String(b.segreto || "")))) return risposta({ stato: "scaduto" })
      if (riga.usato_il) return risposta({ stato: "scaduto" })
      if (!riga.approvato_il) return risposta({ stato: new Date(riga.scade_il).getTime() < adesso ? "scaduto" : "attesa" })
      // approvato: si usa una volta sola
      const usato = await rest("accessi_qr?id=eq." + riga.id + "&usato_il=is.null", "PATCH", { usato_il: new Date().toISOString() })
      if (!usato || !usato.length) return risposta({ stato: "scaduto" })
      // email dell'utente e link di accesso usa-e-getta (non viene spedito: lo usa subito il PC)
      const ru = await fetch(URL_SB + "/auth/v1/admin/users/" + riga.utente_id, { headers: H })
      const u = await ru.json()
      if (!ru.ok || !u.email) return risposta({ error: "Utente non trovato" }, 404)
      const rl = await fetch(URL_SB + "/auth/v1/admin/generate_link", { method: "POST", headers: H, body: JSON.stringify({ type: "magiclink", email: u.email }) })
      const l = await rl.json()
      const tokenHash = l.hashed_token || (l.properties && l.properties.hashed_token)
      if (!rl.ok || !tokenHash) return risposta({ error: "Accesso non riuscito: " + (l.msg || l.message || rl.status) }, 500)
      return risposta({ stato: "ok", token_hash: tokenHash, tipo: l.verification_type || (l.properties && l.properties.verification_type) || "magiclink", email: u.email })
    }

    return risposta({ error: "Azione sconosciuta" }, 400)
  } catch (e) {
    return risposta({ error: String((e as Error).message || e) }, 500)
  }
})
