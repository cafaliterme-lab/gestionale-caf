import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

// Le intestazioni CORS servono su OGNI risposta, anche sugli errori:
// senza, il browser nasconde il messaggio e mostra solo "Failed to fetch"
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
}
function risposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } })
}
function messaggioItaliano(msg: string) {
  const m = String(msg || "")
  if (/already (been )?registered|already exists|email_exists/i.test(m)) return "Esiste già un utente con questa email"
  if (/password.*(at least|short|weak|characters)/i.test(m)) return "Password troppo corta o debole: usa almeno 6 caratteri"
  if (/invalid.*email|email.*invalid|unable to validate email/i.test(m)) return "Indirizzo email non valido"
  return m || "Errore sconosciuto"
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const authHeader = req.headers.get("Authorization") || ""
    if (!authHeader.startsWith("Bearer ")) return risposta({ error: "Accesso scaduto: esci e rientra nel programma" }, 401)
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.slice(7))
    if (authError || !user) return risposta({ error: "Accesso scaduto: esci e rientra nel programma" }, 401)

    const { data: profilo } = await supabase.from("profili").select("ruolo").eq("id", user.id).single()
    if (profilo?.ruolo !== "admin") return risposta({ error: "Solo l'amministratore può gestire gli utenti" }, 403)

    const action = new URL(req.url).pathname.split("/").pop()

    if (action === "create-user" && req.method === "POST") {
      const { email, password, nome, ruolo } = await req.json()
      if (!email || !password) return risposta({ error: "Email e password sono obbligatori" }, 400)
      const nomeMaiuscolo = String(nome || String(email).split("@")[0]).trim().toUpperCase()

      const { data, error } = await supabase.auth.admin.createUser({
        email: String(email).trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { nome: nomeMaiuscolo },
      })
      if (error) return risposta({ error: messaggioItaliano(error.message) }, 400)

      // Il profilo nasce dal trigger sul database; qui lo si rende subito operativo
      // (anagrafica e registro, non in sola lettura). I permessi si cambiano poi da "Utenti e permessi".
      if (data.user) {
        // ruolo scelto alla creazione: operatore, consultazione (operatore in sola lettura) o amministratore
        const admin = ruolo === "admin"
        await supabase.from("profili").upsert({
          id: data.user.id,
          nome: nomeMaiuscolo,
          email: data.user.email,
          ruolo: admin ? "admin" : "operatore",
          tabs: admin
            ? { anagrafica: true, registro: true, contabilita: true, caf: true, collaboratori: true, scadenze: true, messaggi: true, grafici: true }
            : { anagrafica: true, registro: true, contabilita: false, caf: false, collaboratori: false },
          sola_lettura: ruolo === "consultazione",
        }, { onConflict: "id" })
      }
      return risposta({ success: true, user: data.user, message: `Utente ${nomeMaiuscolo} (${data.user?.email}) creato: può già accedere con la sua email e password.` })
    }

    if (action === "delete-user" && req.method === "DELETE") {
      const { user_id } = await req.json()
      if (!user_id) return risposta({ error: "Utente non indicato" }, 400)
      if (user_id === user.id) return risposta({ error: "Non puoi eliminare il tuo account" }, 400)
      const { error } = await supabase.auth.admin.deleteUser(user_id)
      if (error) return risposta({ error: messaggioItaliano(error.message) }, 400)
      return risposta({ success: true, message: "Utente eliminato" })
    }

    if (action === "reset-password" && req.method === "POST") {
      const { user_id, password } = await req.json()
      if (!user_id || !password) return risposta({ error: "Utente e nuova password sono obbligatori" }, 400)
      const { error } = await supabase.auth.admin.updateUserById(user_id, { password })
      if (error) return risposta({ error: messaggioItaliano(error.message) }, 400)
      return risposta({ success: true, message: "Password cambiata" })
    }

    return risposta({ error: "Azione non riconosciuta" }, 400)
  } catch (error) {
    console.error("Errore:", error)
    return risposta({ error: (error as Error).message }, 500)
  }
})
