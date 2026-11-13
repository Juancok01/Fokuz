-- 034: Limpieza de objetos que la app ya no usa.
--
-- 1) public.task_checklist_items: versión antigua de las checklists (006). La app usa
--    task_lists / task_list_items desde la migración 007.
--    Por seguridad solo se borra si está vacía; si tiene filas, la migración se detiene
--    con un mensaje y no borra nada.
-- 2) public.get_shared_tasks_for_date(text): RPC de 005/008 que la app dejó de llamar
--    (las tareas compartidas se leen directamente, protegidas por RLS).
--
-- Es idempotente: se puede ejecutar más de una vez.

do $$
declare
  n bigint;
begin
  if to_regclass('public.task_checklist_items') is not null then
    execute 'select count(*) from public.task_checklist_items' into n;
    if n > 0 then
      raise exception 'task_checklist_items tiene % filas: no se borra. Revisa esos datos antes de continuar.', n;
    end if;
    drop table public.task_checklist_items;
  end if;
end;
$$;

drop function if exists public.get_shared_tasks_for_date(text);
