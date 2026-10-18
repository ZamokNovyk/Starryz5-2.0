-- =======================================================================
-- TABLA DE CRUSHES / FLECHAZOS PARA PROFESORES Y MIEMBROS
-- =======================================================================
CREATE TABLE IF NOT EXISTS public.professor_crushes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    professor_id TEXT NOT NULL,
    firebase_uid TEXT NOT NULL,
    CONSTRAINT professor_crushes_prof_uid_key UNIQUE (professor_id, firebase_uid)
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.professor_crushes ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad para professor_crushes
CREATE POLICY "Permitir lectura de crushes" 
    ON public.professor_crushes FOR SELECT 
    USING (true);

CREATE POLICY "Permitir insercion de crushes" 
    ON public.professor_crushes FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Permitir eliminacion de crushes" 
    ON public.professor_crushes FOR DELETE 
    USING (true);
