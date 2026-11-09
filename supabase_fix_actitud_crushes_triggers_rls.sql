-- ============================================================================
-- SCRIPT DEFINITIVO DE REPARACIÓN: users_actitud, users_crushes Y SUPRESIÓN DE TRIGGER students OBSOLETO
-- Ejecuta este script completo en el SQL Editor de tu Dashboard de Supabase.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ELIMINAR EL TRIGGER OBSOLETO QUE CAUSA EL ERROR (relation "public.students" does not exist)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_sync_actitud_counts_all ON public.users_actitud;
DROP TRIGGER IF EXISTS sync_actitud_counts_all_trigger ON public.users_actitud;
DROP TRIGGER IF EXISTS trg_sync_actitud_counts_all ON public.users_actitud;
DROP FUNCTION IF EXISTS public.sync_actitud_counts_all() CASCADE;

DROP TRIGGER IF EXISTS trigger_sync_crushes_counts_all ON public.users_crushes;
DROP TRIGGER IF EXISTS sync_crushes_counts_all_trigger ON public.users_crushes;
DROP FUNCTION IF EXISTS public.sync_crushes_counts_all() CASCADE;
DROP FUNCTION IF EXISTS public.sync_student_crushes_count() CASCADE;

-- ----------------------------------------------------------------------------
-- 2. ASEGURAR COLUMNAS EN LA TABLA 'users'
-- ----------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS knows_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fans_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS crushes_count INTEGER DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 3. ASEGURAR TABLA 'users_actitud' (Yo te conozco / Fans)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users_actitud (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voter_uid TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  attitude_type TEXT NOT NULL, -- 'yo_te_conozco' | 'fans'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_voter_target UNIQUE (voter_uid, target_user_id),
  CONSTRAINT no_self_vote CHECK (voter_uid <> target_user_id)
);

ALTER TABLE public.users_actitud DROP CONSTRAINT IF EXISTS unique_voter_target_attitude;
ALTER TABLE public.users_actitud DROP CONSTRAINT IF EXISTS unique_voter_target;
ALTER TABLE public.users_actitud ADD CONSTRAINT unique_voter_target UNIQUE (voter_uid, target_user_id);

ALTER TABLE public.users_actitud DROP CONSTRAINT IF EXISTS no_self_vote;
ALTER TABLE public.users_actitud ADD CONSTRAINT no_self_vote CHECK (voter_uid <> target_user_id);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_users_actitud_target ON public.users_actitud(target_user_id);
CREATE INDEX IF NOT EXISTS idx_users_actitud_voter_target ON public.users_actitud(voter_uid, target_user_id);

-- ----------------------------------------------------------------------------
-- 4. ASEGURAR TABLA 'users_crushes' (Flechazos / Crushes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users_crushes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voter_uid TEXT NOT NULL,
  target_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_voter_target_crush UNIQUE (voter_uid, target_user_id),
  CONSTRAINT no_self_crush CHECK (voter_uid <> target_user_id)
);

ALTER TABLE public.users_crushes DROP CONSTRAINT IF EXISTS unique_voter_target_crush;
ALTER TABLE public.users_crushes ADD CONSTRAINT unique_voter_target_crush UNIQUE (voter_uid, target_user_id);

ALTER TABLE public.users_crushes DROP CONSTRAINT IF EXISTS no_self_crush;
ALTER TABLE public.users_crushes ADD CONSTRAINT no_self_crush CHECK (voter_uid <> target_user_id);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_users_crushes_target ON public.users_crushes(target_user_id);
CREATE INDEX IF NOT EXISTS idx_users_crushes_voter_target ON public.users_crushes(voter_uid, target_user_id);

-- ----------------------------------------------------------------------------
-- 5. CONCEDER PERMISOS (GRANT) A ROLES API DE SUPABASE (EVITA EL ERROR 404 NOT FOUND)
-- ----------------------------------------------------------------------------
GRANT ALL ON TABLE public.users_actitud TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.users_crushes TO postgres, anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. HABILITAR SEGURIDAD A NIVEL DE FILA (RLS) Y POLÍTICAS LIMPIAS
-- ----------------------------------------------------------------------------
-- RLS para users_actitud
ALTER TABLE public.users_actitud ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de usuarios actitud" ON public.users_actitud;
DROP POLICY IF EXISTS "Inserción de votos de actitud" ON public.users_actitud;
DROP POLICY IF EXISTS "Actualización de votos de actitud" ON public.users_actitud;
DROP POLICY IF EXISTS "Eliminación de votos de actitud" ON public.users_actitud;
DROP POLICY IF EXISTS "users_actitud_select_all" ON public.users_actitud;
DROP POLICY IF EXISTS "users_actitud_insert_all" ON public.users_actitud;
DROP POLICY IF EXISTS "users_actitud_update_all" ON public.users_actitud;
DROP POLICY IF EXISTS "users_actitud_delete_all" ON public.users_actitud;

CREATE POLICY "users_actitud_select_all"
  ON public.users_actitud FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "users_actitud_insert_all"
  ON public.users_actitud FOR INSERT
  TO anon, authenticated
  WITH CHECK (voter_uid <> target_user_id);

CREATE POLICY "users_actitud_update_all"
  ON public.users_actitud FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (voter_uid <> target_user_id);

CREATE POLICY "users_actitud_delete_all"
  ON public.users_actitud FOR DELETE
  TO anon, authenticated
  USING (true);

-- RLS para users_crushes
ALTER TABLE public.users_crushes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de crushes" ON public.users_crushes;
DROP POLICY IF EXISTS "Inserción de crushes sin autovoto" ON public.users_crushes;
DROP POLICY IF EXISTS "Eliminación de crushes propia" ON public.users_crushes;
DROP POLICY IF EXISTS "users_crushes_select_all" ON public.users_crushes;
DROP POLICY IF EXISTS "users_crushes_insert_all" ON public.users_crushes;
DROP POLICY IF EXISTS "users_crushes_delete_all" ON public.users_crushes;

CREATE POLICY "users_crushes_select_all"
  ON public.users_crushes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "users_crushes_insert_all"
  ON public.users_crushes FOR INSERT
  TO anon, authenticated
  WITH CHECK (voter_uid <> target_user_id);

CREATE POLICY "users_crushes_delete_all"
  ON public.users_crushes FOR DELETE
  TO anon, authenticated
  USING (true);

-- ----------------------------------------------------------------------------
-- 7. NUEVOS TRIGGERS SEGUROS (SECURITY DEFINER) APUNTANDO A 'public.users'
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_users_actitud_counts()
RETURNS TRIGGER AS $$
DECLARE
  v_target_id TEXT;
BEGIN
  v_target_id := COALESCE(NEW.target_user_id, OLD.target_user_id);
  
  IF v_target_id IS NOT NULL THEN
    UPDATE public.users
    SET 
      knows_count = (
        SELECT COUNT(*)::int FROM public.users_actitud 
        WHERE target_user_id = v_target_id AND (attitude_type = 'yo_te_conozco' OR attitude_type = 'knows')
      ),
      fans_count = (
        SELECT COUNT(*)::int FROM public.users_actitud 
        WHERE target_user_id = v_target_id AND (attitude_type = 'fans' OR attitude_type = 'fan')
      )
    WHERE id::text = v_target_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_users_actitud_counts ON public.users_actitud;
CREATE TRIGGER trigger_sync_users_actitud_counts
AFTER INSERT OR UPDATE OR DELETE ON public.users_actitud
FOR EACH ROW
EXECUTE FUNCTION public.sync_users_actitud_counts();

CREATE OR REPLACE FUNCTION public.sync_users_crushes_count()
RETURNS TRIGGER AS $$
DECLARE
  v_target_id TEXT;
BEGIN
  v_target_id := COALESCE(NEW.target_user_id, OLD.target_user_id);
  
  IF v_target_id IS NOT NULL THEN
    UPDATE public.users
    SET 
      crushes_count = (
        SELECT COUNT(*)::int FROM public.users_crushes 
        WHERE target_user_id = v_target_id
      )
    WHERE id::text = v_target_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_users_crushes_count ON public.users_crushes;
CREATE TRIGGER trigger_sync_users_crushes_count
AFTER INSERT OR DELETE ON public.users_crushes
FOR EACH ROW
EXECUTE FUNCTION public.sync_users_crushes_count();

-- ----------------------------------------------------------------------------
-- 8. RECALCULAR CONTADORES PARA USUARIOS EXISTENTES
-- ----------------------------------------------------------------------------
UPDATE public.users u
SET 
  knows_count = (
    SELECT COUNT(*)::int FROM public.users_actitud a 
    WHERE a.target_user_id = u.id::text AND (a.attitude_type = 'yo_te_conozco' OR a.attitude_type = 'knows')
  ),
  fans_count = (
    SELECT COUNT(*)::int FROM public.users_actitud a 
    WHERE a.target_user_id = u.id::text AND (a.attitude_type = 'fans' OR a.attitude_type = 'fan')
  ),
  crushes_count = (
    SELECT COUNT(*)::int FROM public.users_crushes c 
    WHERE c.target_user_id = u.id::text
  );

-- ----------------------------------------------------------------------------
-- 9. RECARGAR CACHÉ DE ESQUEMA EN POSTGREST (ELIMINA 404 INMEDIATAMENTE)
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

