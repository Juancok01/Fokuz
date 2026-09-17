-- Crear tabla youtube_playlists
CREATE TABLE IF NOT EXISTS public.youtube_playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.youtube_playlists ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can view their own youtube playlists"
    ON public.youtube_playlists FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own youtube playlists"
    ON public.youtube_playlists FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own youtube playlists"
    ON public.youtube_playlists FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own youtube playlists"
    ON public.youtube_playlists FOR DELETE
    USING (auth.uid() = user_id);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_youtube_playlists_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_youtube_playlists_updated_at
    BEFORE UPDATE ON public.youtube_playlists
    FOR EACH ROW
    EXECUTE FUNCTION public.update_youtube_playlists_updated_at_column();
