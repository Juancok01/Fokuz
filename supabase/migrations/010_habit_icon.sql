-- Icono por hábito (clave de catálogo en el cliente)
-- Ejecuta en Supabase → SQL Editor → Run

alter table public.habits
  add column if not exists icon text not null default 'sparkles';

-- Refresca el schema cache de PostgREST (necesario para que la API vea la columna)
notify pgrst, 'reload schema';
