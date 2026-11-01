-- ============================================================================
-- SCRIPT DE MIGRACIÓN SUPABASE: TABLA "user-publications" Y STORAGE BUCKET
-- Copia y ejecuta todo este código en el SQL Editor de tu Dashboard de Supabase.
-- ============================================================================

-- 1. Crear tabla "user-publications"
-- Nota: En PostgreSQL, los nombres con guion medio requieren comillas dobles.
CREATE TABLE IF NOT EXISTS public."user-publications" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,                                -- ID del usuario / Firebase UID creador
  created_at TIMESTAMPTZ DEFAULT NOW(),                 -- Fecha de publicación
  image_url TEXT NOT NULL,                              -- Enlace directo de la imagen optimizada
  
  -- 5 columnas que representan cada estrella del 1 al 5
  star_1 INTEGER DEFAULT 0,
  star_2 INTEGER DEFAULT 0,
  star_3 INTEGER DEFAULT 0,
  star_4 INTEGER DEFAULT 0,
  star_5 INTEGER DEFAULT 0,
  
  -- Columna para el porcentaje y promedio general de estrellas
  rating_percentage NUMERIC(5,2) DEFAULT 0.00,
  rating_avg NUMERIC(3,2) DEFAULT 0.00,
  
  -- 4 columnas de interacción y estadísticas
  comments_count INTEGER DEFAULT 0,                     -- Total de comentarios / respuestas
  saves_count INTEGER DEFAULT 0,                        -- Total de guardados
  views_count INTEGER DEFAULT 0,                        -- Total de visualizaciones
  shares_count INTEGER DEFAULT 0,                       -- Total de veces compartido
  
  -- Columna de descripción con límite estricto de 500 caracteres
  description VARCHAR(500),

  -- Metadatos del perfil autor (snapshot para carga ultrarrápida)
  user_display_name TEXT,
  user_username TEXT,
  user_avatar_url TEXT,
  user_badge TEXT DEFAULT '👑 ELITE 4.5+'
);

-- 2. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_user_publications_user_id 
  ON public."user-publications" (user_id);

CREATE INDEX IF NOT EXISTS idx_user_publications_created_at 
  ON public."user-publications" (created_at DESC);

-- 3. Habilitar Seguridad de Nivel de Fila (RLS)
ALTER TABLE public."user-publications" ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Permisos RLS para "user-publications"
DROP POLICY IF EXISTS "Lectura pública de publicaciones" ON public."user-publications";
CREATE POLICY "Lectura pública de publicaciones"
  ON public."user-publications" FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Inserción de publicaciones para usuarios" ON public."user-publications";
CREATE POLICY "Inserción de publicaciones para usuarios"
  ON public."user-publications" FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Actualización de publicaciones propia" ON public."user-publications";
CREATE POLICY "Actualización de publicaciones propia"
  ON public."user-publications" FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Eliminación de publicaciones propia" ON public."user-publications";
CREATE POLICY "Eliminación de publicaciones propia"
  ON public."user-publications" FOR DELETE
  USING (true);

-- 5. Configurar Bucket de Almacenamiento "user-publications" en Supabase Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-publications', 'user-publications', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage para el bucket "user-publications"
DROP POLICY IF EXISTS "Acceso público a imágenes de publicaciones" ON storage.objects;
CREATE POLICY "Acceso público a imágenes de publicaciones"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'user-publications');

DROP POLICY IF EXISTS "Subida de imágenes de publicaciones" ON storage.objects;
CREATE POLICY "Subida de imágenes de publicaciones"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'user-publications');

DROP POLICY IF EXISTS "Eliminación de imágenes de publicaciones" ON storage.objects;
CREATE POLICY "Eliminación de imágenes de publicaciones"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'user-publications');
