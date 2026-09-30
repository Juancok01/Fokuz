-- Hora de fin del bloque (el campo end_date es tipo date y no conserva HH:mm)
alter table public.tasks add column if not exists end_time time;

comment on column public.tasks.end_time is 'Hora de fin del bloque programado, independiente de end_date.';
