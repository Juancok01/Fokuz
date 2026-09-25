-- Migración para etiquetas por tablero
ALTER TABLE public.tags 
  ADD COLUMN IF NOT EXISTS board_id BIGINT REFERENCES public.boards(id) ON DELETE CASCADE;

-- Eliminar el índice anterior que las hacía únicas por usuario
DROP INDEX IF EXISTS public.tags_user_name_idx;

-- Crear un nuevo índice para que las etiquetas sean únicas por tablero y nombre
CREATE UNIQUE INDEX IF NOT EXISTS tags_board_name_idx 
  ON public.tags (board_id, lower(name));
