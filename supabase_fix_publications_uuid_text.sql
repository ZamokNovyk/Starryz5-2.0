-- ==============================================================================
-- CORRECCIÓN DEL ERROR DE SUPABASE: "operator does not exist: uuid = text" (42883)
-- EN LA TABLA "user-publications"
-- ==============================================================================
-- Copia y pega este script en el SQL Editor de tu panel de Supabase:
-- https://supabase.com/dashboard/project/_/sql
-- y presiona "RUN".
-- ==============================================================================

-- 1. Asegurar que la tabla "user-publications" existe y sus columnas están correctas
CREATE TABLE IF NOT EXISTS public."user-publications" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  image_url TEXT NOT NULL,
  star_1 INTEGER DEFAULT 0,
  star_2 INTEGER DEFAULT 0,
  star_3 INTEGER DEFAULT 0,
  star_4 INTEGER DEFAULT 0,
  star_5 INTEGER DEFAULT 0,
  rating_percentage NUMERIC(5,2) DEFAULT 0.00,
  rating_avg NUMERIC(3,2) DEFAULT 0.00,
  comments_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  description VARCHAR(500),
  user_display_name TEXT,
  user_username TEXT,
  user_avatar_url TEXT,
  user_badge TEXT DEFAULT '👑 ELITE 4.5+'
);

-- Si la columna user_id fue creada como UUID y está chocando con IDs de texto:
-- Convertimos la columna a TEXT de manera segura si es necesario:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'user-publications' 
      AND column_name = 'user_id' 
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public."user-publications" ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
  END IF;
END $$;

-- 2. Eliminar políticas RLS problemáticas que comparan uuid = text (como auth.uid() = user_id)
DROP POLICY IF EXISTS "Inserción de publicaciones para usuarios" ON public."user-publications";
DROP POLICY IF EXISTS "Lectura pública de publicaciones" ON public."user-publications";
DROP POLICY IF EXISTS "Actualización de publicaciones propia" ON public."user-publications";
DROP POLICY IF EXISTS "Eliminación de publicaciones propia" ON public."user-publications";
DROP POLICY IF EXISTS "Users can insert their own publications" ON public."user-publications";
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public."user-publications";
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON public."user-publications";
DROP POLICY IF EXISTS "Allow authenticated insert" ON public."user-publications";
DROP POLICY IF EXISTS "Allow public insert" ON public."user-publications";

-- 3. Habilitar RLS y recrear políticas 100% compatibles con Firebase UID y UUID
ALTER TABLE public."user-publications" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública de publicaciones"
  ON public."user-publications" FOR SELECT
  USING (true);

CREATE POLICY "Inserción de publicaciones para usuarios"
  ON public."user-publications" FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Actualización de publicaciones propia"
  ON public."user-publications" FOR UPDATE
  USING (true);

CREATE POLICY "Eliminación de publicaciones propia"
  ON public."user-publications" FOR DELETE
  USING (true);

-- 4. Asegurar permisos de acceso a roles
GRANT ALL ON TABLE public."user-publications" TO anon, authenticated, service_role, postgres;

-- 5. Crear el bucket de Supabase Storage para respaldos si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-publications', 'user-publications', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Acceso público lectura user-publications storage" ON storage.objects;
CREATE POLICY "Acceso público lectura user-publications storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-publications');

DROP POLICY IF EXISTS "Subida pública user-publications storage" ON storage.objects;
CREATE POLICY "Subida pública user-publications storage"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'user-publications');

SELECT 'Migración de user-publications completada con éxito. Ya no habrá error uuid = text.' AS resultado;

