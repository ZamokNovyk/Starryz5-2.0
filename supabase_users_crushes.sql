-- ============================================================================
-- SCRIPT DE MIGRACIÓN SUPABASE: TABLA 'users_crushes' Y CONTADOR EN 'users'
-- Copia y ejecuta todo este bloque en el SQL Editor de tu Dashboard de Supabase.
-- ============================================================================

-- 1. Crear tabla 'users_crushes'
CREATE TABLE IF NOT EXISTS public.users_crushes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voter_uid TEXT NOT NULL,       -- ID / Firebase UID del usuario que da el flechazo
  target_user_id TEXT NOT NULL,  -- ID / Firebase UID del usuario objetivo que recibe el crush
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_voter_target_crush UNIQUE (voter_uid, target_user_id),
  CONSTRAINT no_self_crush CHECK (voter_uid <> target_user_id)
);

-- 2. Agregar columna acumulada 'crushes_count' a la tabla 'users'
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS crushes_count INTEGER DEFAULT 0;

-- 3. Habilitar Seguridad de Nivel de Fila (RLS)
ALTER TABLE public.users_crushes ENABLE ROW LEVEL SECURITY;

-- 4. Crear Políticas de Permisos RLS para 'users_crushes'
DROP POLICY IF EXISTS "Lectura pública de crushes" ON public.users_crushes;
CREATE POLICY "Lectura pública de crushes"
  ON public.users_crushes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Inserción de crushes sin autovoto" ON public.users_crushes;
CREATE POLICY "Inserción de crushes sin autovoto"
  ON public.users_crushes FOR INSERT
  WITH CHECK (voter_uid <> target_user_id);

DROP POLICY IF EXISTS "Eliminación de crushes propia" ON public.users_crushes;
CREATE POLICY "Eliminación de crushes propia"
  ON public.users_crushes FOR DELETE
  USING (true);

-- 5. Crear función Trigger para sincronizar automáticamente 'crushes_count' en 'users'
CREATE OR REPLACE FUNCTION public.sync_users_crushes_count()
RETURNS TRIGGER AS $$
DECLARE
  target_id TEXT;
BEGIN
  target_id := COALESCE(NEW.target_user_id, OLD.target_user_id);
  
  UPDATE public.users
  SET 
    crushes_count = (
      SELECT COUNT(*) FROM public.users_crushes 
      WHERE target_user_id = target_id
    )
  WHERE id::text = target_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Vincular el Trigger a la tabla 'users_crushes'
DROP TRIGGER IF EXISTS trigger_sync_users_crushes_count ON public.users_crushes;
CREATE TRIGGER trigger_sync_users_crushes_count
AFTER INSERT OR DELETE ON public.users_crushes
FOR EACH ROW
EXECUTE FUNCTION public.sync_users_crushes_count();

-- 7. Recalcular contadores de crushes existentes para todos los usuarios
UPDATE public.users u
SET 
  crushes_count = (
    SELECT COUNT(*) FROM public.users_crushes c 
    WHERE c.target_user_id = u.id::text
  );

-- 8. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_users_crushes_target ON public.users_crushes(target_user_id);
CREATE INDEX IF NOT EXISTS idx_users_crushes_voter_target ON public.users_crushes(voter_uid, target_user_id);
