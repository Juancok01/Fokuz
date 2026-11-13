-- Versículos guardados: permitir editar la nota/reflexión.
-- 019_saved_verses.sql solo creó políticas de select, insert y delete; sin una política
-- de update, Supabase descartaba en silencio cada nota (0 filas actualizadas, sin error).
-- Ejecuta en Supabase → SQL Editor → Run

drop policy if exists "Users can update their own saved verses" on public.saved_verses;

create policy "Users can update their own saved verses"
    on public.saved_verses for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
