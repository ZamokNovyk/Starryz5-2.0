-- ============================================================================
-- SCRIPT DE MIGRACIÓN PARA SUPABASE:
-- 1. TABLA 'user_reseñas' (Para votos y calificaciones por estrellas)
-- 2. TABLA 'users_crushes' (Para flechazos / crushes unificados)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PARTE 1: CREAR Y CONFIGURAR LA TABLA 'user_reseñas'
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_reseñas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voter_uid TEXT NOT NULL,       -- UID del usuario que califica
  target_user_id TEXT NOT NULL,  -- ID del estudiante o usuario calificado
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS en 'user_reseñas'
ALTER TABLE public.user_reseñas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de user_reseñas" ON public.user_reseñas;
CREATE POLICY "Lectura pública de user_reseñas"
  ON public.user_reseñas FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Inserción pública de user_reseñas" ON public.user_reseñas;
CREATE POLICY "Inserción pública de user_reseñas"
  ON public.user_reseñas FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Actualización de user_reseñas" ON public.user_reseñas;
CREATE POLICY "Actualización de user_reseñas"
  ON public.user_reseñas FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Eliminación de user_reseñas" ON public.user_reseñas;
CREATE POLICY "Eliminación de user_reseñas"
  ON public.user_reseñas FOR DELETE
  USING (true);

-- Índices para consultas ultra rápidas
CREATE INDEX IF NOT EXISTS idx_user_reseñas_target ON public.user_reseñas(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reseñas_voter ON public.user_reseñas(voter_uid);
CREATE INDEX IF NOT EXISTS idx_user_reseñas_target_voter ON public.user_reseñas(target_user_id, voter_uid);

-- Migrar votos históricos desde 'student_votes' a 'user_reseñas' (si existe la tabla antigua)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_votes') THEN
    INSERT INTO public.user_reseñas (voter_uid, target_user_id, stars, created_at)
    SELECT 
      sv.user_uid, 
      sv.student_id, 
      sv.stars,
      COALESCE(sv.created_at, NOW())
    FROM public.student_votes sv
    WHERE sv.stars >= 1 AND sv.stars <= 5;
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- PARTE 2: CONFIGURAR 'users_crushes' (Y CORREGIR TRIGGER SIN firebase_uid)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users_crushes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voter_uid TEXT NOT NULL,       -- UID del usuario que flecha
  target_user_id TEXT NOT NULL,  -- ID del estudiante o usuario flechado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_voter_target_crush UNIQUE (voter_uid, target_user_id),
  CONSTRAINT no_self_crush CHECK (voter_uid <> target_user_id)
);

ALTER TABLE public.users_crushes ENABLE ROW LEVEL SECURITY;

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

-- Función trigger para sincronizar contadores usando 'id::text' (evita error con firebase_uid)
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

DROP TRIGGER IF EXISTS trigger_sync_users_crushes_count ON public.users_crushes;
CREATE TRIGGER trigger_sync_users_crushes_count
AFTER INSERT OR DELETE ON public.users_crushes
FOR EACH ROW
EXECUTE FUNCTION public.sync_users_crushes_count();

CREATE INDEX IF NOT EXISTS idx_users_crushes_target ON public.users_crushes(target_user_id);
CREATE INDEX IF NOT EXISTS idx_users_crushes_voter_target ON public.users_crushes(voter_uid, target_user_id);

-- Migrar crushes históricos desde 'student_crushes' a 'users_crushes' (si existe la tabla antigua)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_crushes') THEN
    INSERT INTO public.users_crushes (voter_uid, target_user_id, created_at)
    SELECT 
      sc.user_uid, 
      sc.student_id, 
      COALESCE(sc.created_at, NOW())
    FROM public.student_crushes sc
    WHERE sc.user_uid <> sc.student_id
    ON CONFLICT (voter_uid, target_user_id) DO NOTHING;
  END IF;
END $$;
