-- Nombre personalizado del contacto (cómo lo ve el usuario que lo agregó)
-- Ejecuta en Supabase → SQL Editor → Run

alter table public.contacts
  add column if not exists nickname text;

drop policy if exists "Users can update own contacts" on public.contacts;

create policy "Users can update own contacts"
  on public.contacts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
