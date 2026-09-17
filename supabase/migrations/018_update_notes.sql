-- Actualizar tabla notes para soportar carpetas y anclado

ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.note_folders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;

-- Crear índice para rendimiento de búsquedas por carpeta
CREATE INDEX IF NOT EXISTS notes_folder_id_idx ON public.notes (folder_id);
