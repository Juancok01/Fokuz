-- Crear tabla note_folders
CREATE TABLE IF NOT EXISTS public.note_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.note_folders ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can view their own note folders"
    ON public.note_folders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own note folders"
    ON public.note_folders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own note folders"
    ON public.note_folders FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own note folders"
    ON public.note_folders FOR DELETE
    USING (auth.uid() = user_id);
