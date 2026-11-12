-- Notas compartidas: quien recibe una nota puede editarla (RLS de 012_note_shares.sql),
-- pero no debe poder cambiar su dueño (user_id) ni moverla dentro de otra nota (parent_id).
-- Ejecuta en Supabase → SQL Editor → Run

create or replace function public.notes_protect_owner()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'No se puede cambiar el dueño de una nota';
  end if;

  if new.parent_id is distinct from old.parent_id and auth.uid() is distinct from old.user_id then
    raise exception 'Solo el dueño puede mover la nota';
  end if;

  return new;
end;
$$;

drop trigger if exists notes_protect_owner on public.notes;
create trigger notes_protect_owner
before update on public.notes
for each row
execute function public.notes_protect_owner();
