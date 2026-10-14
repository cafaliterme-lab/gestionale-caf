-- Ultimo accesso con password/QR di ogni utente (solo amministratore): serve in "Chi è collegato"
-- quando il programma è stato aperto per poco e la presenza non ha fatto in tempo a registrarsi.
create or replace function public.ultimi_accessi()
returns table(id uuid, ultimo_login timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select u.id, u.last_sign_in_at from auth.users u where public.e_admin()
$$;
revoke all on function public.ultimi_accessi() from public, anon;
grant execute on function public.ultimi_accessi() to authenticated;
