-- Reparación rápida de contactos / nickname
-- Ejecuta TODO este archivo en Supabase → SQL Editor → Run

-- 1) Columna nickname
alter table public.contacts
  add column if not exists nickname text;

-- 2) Política para actualizar nickname
drop policy if exists "Users can update own contacts" on public.contacts;
create policy "Users can update own contacts"
  on public.contacts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3) Asegurar perfiles de todos los usuarios auth
insert into public.profiles (id, email, display_name)
select
  u.id,
  u.email,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'alias'), ''),
    split_part(u.email, '@', 1)
  )
from auth.users u
on conflict (id) do update
  set email = excluded.email,
      updated_at = now();

-- 4) Recrear función de agregar contacto (por si faltaba)
create or replace function public.add_contact_by_email(contact_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  target public.profiles%rowtype;
  normalized text := lower(trim(contact_email));
begin
  if me is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  if normalized is null or normalized = '' or position('@' in normalized) = 0 then
    return json_build_object('ok', false, 'error', 'invalid_email');
  end if;

  perform public.ensure_my_profile();

  select * into target
  from public.profiles
  where lower(email) = normalized
  limit 1;

  if not found then
    return json_build_object('ok', false, 'error', 'not_found');
  end if;

  if target.id = me then
    return json_build_object('ok', false, 'error', 'self');
  end if;

  insert into public.contacts (user_id, contact_user_id)
  values (me, target.id)
  on conflict (user_id, contact_user_id) do nothing;

  return json_build_object(
    'ok', true,
    'contact', json_build_object(
      'id', target.id,
      'email', target.email,
      'display_name', coalesce(nullif(trim(target.display_name), ''), split_part(target.email, '@', 1))
    )
  );
end;
$$;

grant execute on function public.add_contact_by_email(text) to authenticated;
