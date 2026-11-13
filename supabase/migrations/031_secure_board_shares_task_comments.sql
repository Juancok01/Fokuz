-- 031: Seguridad de board_shares y task_comments.
-- En producción estas tablas tenían políticas creadas a mano con condición "true":
-- cualquier usuario con sesión podía leer TODOS los comentarios de tareas de todos los
-- usuarios, comentar en tareas ajenas haciéndose pasar por otro (user_id sin validar)
-- y ver/crear/modificar registros de tableros compartidos ajenos. Además board_shares no
-- tenía política de DELETE, así que dejar de compartir un tablero fallaba en silencio.
--
-- Esta migración reemplaza esas políticas por unas restringidas al dueño de la
-- información. Ejecuta en Supabase → SQL Editor → Run

-- board_shares ---------------------------------------------------------------------------
alter table public.board_shares enable row level security;

drop policy if exists "Permitir select board_shares" on public.board_shares;
drop policy if exists "Permitir insert board_shares" on public.board_shares;
drop policy if exists "Permitir update board_shares" on public.board_shares;
drop policy if exists "Permitir delete board_shares" on public.board_shares;
drop policy if exists "board_shares_select" on public.board_shares;
drop policy if exists "board_shares_insert" on public.board_shares;
drop policy if exists "board_shares_update" on public.board_shares;
drop policy if exists "board_shares_delete" on public.board_shares;

-- Lo ven el dueño del tablero y la persona invitada
create policy "board_shares_select" on public.board_shares for select to authenticated using (
  auth.uid() = shared_with
  or exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid())
);

-- Solo el dueño del tablero comparte (insert) o reescribe un registro (upsert)
create policy "board_shares_insert" on public.board_shares for insert to authenticated with check (
  exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid())
);
create policy "board_shares_update" on public.board_shares for update to authenticated
  using (exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid()));

-- El dueño quita a cualquiera; el invitado puede salirse
create policy "board_shares_delete" on public.board_shares for delete to authenticated using (
  auth.uid() = shared_with
  or exists (select 1 from public.boards b where b.id = board_id and b.user_id = auth.uid())
);

-- task_comments ---------------------------------------------------------------------------
alter table public.task_comments enable row level security;

drop policy if exists "Permitir select task_comments" on public.task_comments;
drop policy if exists "Permitir insert task_comments" on public.task_comments;
drop policy if exists "Permitir delete task_comments" on public.task_comments;
drop policy if exists "task_comments_select" on public.task_comments;
drop policy if exists "task_comments_insert" on public.task_comments;
drop policy if exists "task_comments_delete" on public.task_comments;

-- Se leen solo los comentarios de tareas que yo puedo ver. La subconsulta a tasks
-- respeta la RLS de tasks (dueño o tarea compartida conmigo).
create policy "task_comments_select" on public.task_comments for select to authenticated using (
  exists (select 1 from public.tasks t where t.id = task_id)
);

-- Solo comento como yo mismo y en tareas que puedo ver
create policy "task_comments_insert" on public.task_comments for insert to authenticated with check (
  auth.uid() = user_id
  and exists (select 1 from public.tasks t where t.id = task_id)
);

-- Cada quien borra solo sus comentarios
create policy "task_comments_delete" on public.task_comments for delete to authenticated using (
  auth.uid() = user_id
);
