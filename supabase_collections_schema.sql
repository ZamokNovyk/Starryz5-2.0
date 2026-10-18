-- =======================================================================
-- SQL SUPABASE: TABLAS PARA COLECCIONES Y ELEMENTOS GUARDADOS
-- =======================================================================
-- Copia y ejecuta este script en el SQL Editor de tu panel de Supabase.

-- 1. Tabla de Colecciones
CREATE TABLE IF NOT EXISTS public.collections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    firebase_uid TEXT NOT NULL,
    name TEXT NOT NULL,
    CONSTRAINT collections_firebase_uid_name_key UNIQUE (firebase_uid, name)
);

-- Habilitar RLS (Seguridad a Nivel de Fila) en collections
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad para collections
CREATE POLICY "Permitir lectura de colecciones propias" 
    ON public.collections FOR SELECT 
    USING (true); -- o USING (firebase_uid = auth.uid()::text) si se usa Supabase Auth directo

CREATE POLICY "Permitir inserción de colecciones propias" 
    ON public.collections FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Permitir eliminación de colecciones propias" 
    ON public.collections FOR DELETE 
    USING (true);


-- 2. Tabla de Elementos de Colección (Saved Items)
CREATE TABLE IF NOT EXISTS public.collection_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE NOT NULL,
    firebase_uid TEXT NOT NULL,
    item_id TEXT NOT NULL, -- Slug o ID del Profesor o Centro
    item_type TEXT NOT NULL CHECK (item_type IN ('professor', 'center')),
    item_name TEXT NOT NULL,
    item_image TEXT,
    item_subtitle TEXT,
    CONSTRAINT collection_items_uid_collection_item_key UNIQUE (firebase_uid, collection_id, item_id)
);

-- Habilitar RLS en collection_items
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad para collection_items
CREATE POLICY "Permitir lectura de elementos propios" 
    ON public.collection_items FOR SELECT 
    USING (true);

CREATE POLICY "Permitir inserción de elementos propios" 
    ON public.collection_items FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Permitir eliminación de elementos propios" 
    ON public.collection_items FOR DELETE 
    USING (true);


-- 3. Crear automáticamente una colección inicial 'Guardados' por defecto para cada usuario
-- Esta función crea la colección 'Guardados' cuando el usuario registra o guarda su primer elemento
CREATE OR REPLACE FUNCTION public.ensure_default_collection(p_firebase_uid TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_collection_id UUID;
BEGIN
    -- Comprobar si ya existe
    SELECT id INTO v_collection_id 
    FROM public.collections 
    WHERE firebase_uid = p_firebase_uid AND LOWER(name) = 'guardados'
    LIMIT 1;

    -- Si no existe, crearla
    IF v_collection_id IS NULL THEN
        INSERT INTO public.collections (firebase_uid, name)
        VALUES (p_firebase_uid, 'Guardados')
        RETURNING id INTO v_collection_id;
    END IF;

    RETURN v_collection_id;
END;
$$;
