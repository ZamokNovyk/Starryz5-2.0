-- ============================================================================
-- MIGRACIÓN UNIFICADA: VOTOS DE ESTUDIANTES DIRECTO A 'users_actitud'
-- (Incluye corrección de la función trigger previa que buscaba 'firebase_uid')
-- ============================================================================

-- 1. Asegurar que la tabla 'users_actitud' existe con su estructura completa
CREATE TABLE IF NOT EXISTS public.users_actitud (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voter_uid TEXT NOT NULL,       -- UID del usuario que vota
  target_user_id TEXT NOT NULL,  -- ID del estudiante o usuario votado
  attitude_type TEXT NOT NULL,   -- 'yo_te_conozco' | 'fans'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_voter_target UNIQUE (voter_uid, target_user_id),
  CONSTRAINT no_self_vote CHECK (voter_uid <> target_user_id)
);

-- 2. Asegurar restricción UNIQUE de voto único
ALTER TABLE public.users_actitud DROP CONSTRAINT IF EXISTS unique_voter_target_attitude;
ALTER TABLE public.users_actitud DROP CONSTRAINT IF EXISTS unique_voter_target;
ALTER TABLE public.users_actitud ADD CONSTRAINT unique_voter_target UNIQUE (voter_uid, target_user_id);

-- 3. Habilitar RLS y políticas públicas
ALTER TABLE public.users_actitud ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de users_actitud" ON public.users_actitud;
CREATE POLICY "Lectura pública de users_actitud"
  ON public.users_actitud FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Inserción pública de users_actitud" ON public.users_actitud;
CREATE POLICY "Inserción pública de users_actitud"
  ON public.users_actitud FOR INSERT
  WITH CHECK (voter_uid <> target_user_id);

DROP POLICY IF EXISTS "Actualización de users_actitud" ON public.users_actitud;
CREATE POLICY "Actualización de users_actitud"
  ON public.users_actitud FOR UPDATE
  USING (true)
  WITH CHECK (voter_uid <> target_user_id);

DROP POLICY IF EXISTS "Eliminación de users_actitud" ON public.users_actitud;
CREATE POLICY "Eliminación de users_actitud"
  ON public.users_actitud FOR DELETE
  USING (true);

-- 4. Índices para acelerar conteos de Yo te conozco y Fans
CREATE INDEX IF NOT EXISTS idx_users_actitud_target ON public.users_actitud(target_user_id);
CREATE INDEX IF NOT EXISTS idx_users_actitud_voter_target ON public.users_actitud(voter_uid, target_user_id);

-- 5. CORRECCIÓN CLAVE: Actualizar la función trigger para que use 'id::text' en vez de 'firebase_uid'
CREATE OR REPLACE FUNCTION public.sync_users_actitud_counts()
RETURNS TRIGGER AS $$
DECLARE
  target_id TEXT;
BEGIN
  target_id := COALESCE(NEW.target_user_id, OLD.target_user_id);
  
  -- Solo intenta actualizar users si el target coincide con un id de la tabla users
  UPDATE public.users
  SET 
    knows_count = (
      SELECT COUNT(*) FROM public.users_actitud 
      WHERE target_user_id = target_id AND attitude_type = 'yo_te_conozco'
    ),
    fans_count = (
      SELECT COUNT(*) FROM public.users_actitud 
      WHERE target_user_id = target_id AND attitude_type = 'fans'
    )
  WHERE id::text = target_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Migrar votos históricos desde 'student_interactions' hacia 'users_actitud'
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_interactions') THEN
    INSERT INTO public.users_actitud (voter_uid, target_user_id, attitude_type, created_at)
    SELECT 
      si.user_uid, 
      si.student_id, 
      CASE 
        WHEN si.interaction_type = 'knows' THEN 'yo_te_conozco'
        WHEN si.interaction_type = 'fan' THEN 'fans'
        ELSE si.interaction_type
      END,
      COALESCE(si.created_at, NOW())
    FROM public.student_interactions si
    WHERE si.user_uid <> si.student_id
    ON CONFLICT (voter_uid, target_user_id) 
    DO UPDATE SET attitude_type = EXCLUDED.attitude_type;
  END IF;
END $$;
