-- Hora de la tarea (el campo date es tipo date y no conserva HH:mm)
alter table public.tasks add column if not exists start_time time;

comment on column public.tasks.start_time is 'Hora programada de la tarea, independiente de date.';
