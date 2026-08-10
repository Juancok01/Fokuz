-- Icono por hábito (clave de catálogo en el cliente)
-- Ejecuta en Supabase → SQL Editor → Run

alter table public.habits
  add column if not exists icon text not null default 'sparkles';
