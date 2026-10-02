import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

serve(async (req) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  }

  try {
    // Verifica che il chiamante sia autenticato
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    const jwt = authHeader.slice(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      )
    }

    // Verifica che il chiamante sia admin
    const { data: profilo } = await supabase
      .from("profili")
      .select("ruolo")
      .eq("id", user.id)
      .single()

    if (profilo?.ruolo !== "admin") {
      return new Response(
        JSON.stringify({ error: "Permesso negato: solo admin" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    }

    const url = new URL(req.url)
    const action = url.pathname.split("/").pop()

    if (action === "create-user" && req.method === "POST") {
      // Crea nuovo utente
      const { email, password, nome } = await req.json()

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email e password sono obbligatori" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome: nome || email.split("@")[0] },
      })

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: data.user,
          message: `Utente ${email} creato. Il profilo verrà creato automaticamente al primo login.`,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      )
    }

    if (action === "delete-user" && req.method === "DELETE") {
      // Elimina utente
      const { user_id } = await req.json()

      if (!user_id) {
        return new Response(
          JSON.stringify({ error: "user_id è obbligatorio" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      // Non permettere di eliminare se stesso
      if (user_id === user.id) {
        return new Response(
          JSON.stringify({ error: "Non puoi eliminare il tuo account" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      const { error } = await supabase.auth.admin.deleteUser(user_id)

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, message: "Utente eliminato" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      )
    }

    if (action === "reset-password" && req.method === "POST") {
      // Reset password
      const { user_id, password } = await req.json()

      if (!user_id || !password) {
        return new Response(
          JSON.stringify({ error: "user_id e password sono obbligatori" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      const { error } = await supabase.auth.admin.updateUserById(user_id, {
        password,
      })

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, message: "Password resettata" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: "Azione non riconosciuta" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("Error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
