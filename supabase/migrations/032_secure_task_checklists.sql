-- 032: Seguridad de checklists de tareas.
-- 006_task_checklist.sql y 007_task_lists.sql crearon políticas con condición "true":
-- cualquier usuario con sesión podía leer, crear, modificar y BORRAR los checklists
-- (task_lists, task_list_items) y task_checklist_items de las tareas de todos.
--
-- Nueva regla: se puede trabajar con el checklist de una tarea solo si esa tarea es
-- visible para mí (soy el dueño o me la compartieron). Las subconsultas respetan la
-- RLS de tasks y de task_lists, así que heredan esos permisos.
-- Ejecuta en Supabase → SQL Editor → Run

-- task_lists (checklists de una tarea) -------------------------------------------------
alter table public.task_lists enable row level security;

drop policy if exists "Authenticated can select task lists" on public.task_lists;
drop policy if exists "Authenticated can insert task lists" on public.task_lists;
drop policy if exists "Authenticated can update task lists" on public.task_lists;
drop policy if exists "Authenticated can delete task lists" on public.task_lists;
drop policy if exists "task_lists_select" on public.task_lists;
drop policy if exists "task_lists_insert" on public.task_lists;
drop policy if exists "task_lists_update" on public.task_lists;
drop policy if exists "task_lists_delete" on public.task_lists;

create policy "task_lists_select" on public.task_lists for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));
create policy "task_lists_insert" on public.task_lists for insert to authenticated
  with check (exists (select 1 from public.tasks t where t.id = task_id));
create policy "task_lists_update" on public.task_lists for update to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id))
  with check (exists (select 1 from public.tasks t where t.id = task_id));
create policy "task_lists_delete" on public.task_lists for delete to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id));

-- task_list_items (ítems de cada checklist) --------------------------------------------
alter table public.task_list_items enable row level security;

drop policy if exists "Authenticated can select task list items" on public.task_list_items;
drop policy if exists "Authenticated can insert task list items" on public.task_list_items;
drop policy if exists "Authenticated can update task list items" on public.task_list_items;
drop policy if exists "Authenticated can delete task list items" on public.task_list_items;
drop policy if exists "task_list_items_select" on public.task_list_items;
drop policy if exists "task_list_items_insert" on public.task_list_items;
drop policy if exists "task_list_items_update" on public.task_list_items;
drop policy if exists "task_list_items_delete" on public.task_list_items;

create policy "task_list_items_select" on public.task_list_items for select to authenticated
  using (exists (select 1 from public.task_lists l where l.id = list_id));
create policy "task_list_items_insert" on public.task_list_items for insert to authenticated
  with check (exists (select 1 from public.task_lists l where l.id = list_id));
create policy "task_list_items_update" on public.task_list_items for update to authenticated
  using (exists (select 1 from public.task_lists l where l.id = list_id))
  with check (exists (select 1 from public.task_lists l where l.id = list_id));
create policy "task_list_items_delete" on public.task_list_items for delete to authenticated
  using (exists (select 1 from public.task_lists l where l.id = list_id));

-- task_checklist_items (versión antigua, sin uso en la app) -----------------------------
alter table public.task_checklist_items enable row level security;

drop policy if exists "Authenticated can select checklist items" on public.task_checklist_items;
drop policy if exists "Authenticated can insert checklist items" on public.task_checklist_items;
drop policy if exists "Authenticated can update checklist items" on public.task_checklist_items;
drop policy if exists "Authenticated can delete checklist items" on public.task_checklist_items;
drop policy if exists "task_checklist_items_all" on public.task_checklist_items;

create policy "task_checklist_items_all" on public.task_checklist_items for all to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id))
  with check (exists (select 1 from public.tasks t where t.id = task_id));
