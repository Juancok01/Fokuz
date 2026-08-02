-- Acceso a tareas compartidas: ver y editar
-- Ejecuta en Supabase → SQL Editor → Run

create index if not exists task_shares_shared_with_idx
  on public.task_shares (shared_with);

create index if not exists task_shares_task_id_idx
  on public.task_shares (task_id);

-- Helper: ¿esta tarea está compartida conmigo?
create or replace function public.task_is_shared_with_me(p_task_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.task_shares s
    where s.task_id = p_task_id
      and s.shared_with = auth.uid()
  );
$$;

grant execute on function public.task_is_shared_with_me(bigint) to authenticated;

-- Ver tareas compartidas conmigo (además de las propias)
drop policy if exists "Users can select tasks shared with them" on public.tasks;
create policy "Users can select tasks shared with them"
  on public.tasks for select
  to authenticated
  using (public.task_is_shared_with_me(id));

-- Editar tareas compartidas conmigo (completar, novedad, fecha, etc.)
drop policy if exists "Users can update tasks shared with them" on public.tasks;
create policy "Users can update tasks shared with them"
  on public.tasks for update
  to authenticated
  using (public.task_is_shared_with_me(id))
  with check (public.task_is_shared_with_me(id));

-- Ver etiqueta de una tarea compartida
drop policy if exists "Users can select tags on shared tasks" on public.tags;
create policy "Users can select tags on shared tasks"
  on public.tags for select
  to authenticated
  using (
    exists (
      select 1
      from public.tasks t
      join public.task_shares s on s.task_id = t.id
      where t.tag_id = tags.id
        and s.shared_with = auth.uid()
    )
  );

-- RPC más robusta (fecha como date)
create or replace function public.get_shared_tasks_for_date(target_date text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  result json;
  d date;
begin
  if me is null then
    return '[]'::json;
  end if;

  begin
    d := target_date::date;
  exception when others then
    return '[]'::json;
  end;

  select coalesce(json_agg(row_to_json(t)), '[]'::json)
  into result
  from (
    select
      tasks.*,
      case
        when tags.id is null then null
        else json_build_object('id', tags.id, 'name', tags.name, 'color', tags.color)
      end as tags
    from public.tasks
    join public.task_shares s on s.task_id = tasks.id
    left join public.tags on tags.id = tasks.tag_id
    where s.shared_with = me
      and tasks.date::date = d
    order by tasks.order_index asc nulls last
  ) t;

  return result;
end;
$$;

grant execute on function public.get_shared_tasks_for_date(text) to authenticated;
