-- ============================================================================
-- SCRIPT DE MIGRACIÓN PARA SUPABASE: TABLA users_actitud (SISTEMA DE VOTO ÚNICO EXCLUSIVO)
-- Copia y ejecuta todo este bloque en el SQL Editor de tu Dashboard de Supabase.
-- ============================================================================

-- 1. Crear tabla 'users_actitud' si no existe
CREATE TABLE IF NOT EXISTS public.users_actitud (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  voter_uid TEXT NOT NULL,       -- ID / Firebase UID del usuario que vota
  target_user_id TEXT NOT NULL,  -- ID / Firebase UID del usuario que recibe el voto
  attitude_type TEXT NOT NULL,   -- 'yo_te_conozco' | 'fans'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_voter_target UNIQUE (voter_uid, target_user_id),
  CONSTRAINT no_self_vote CHECK (voter_uid <> target_user_id)
);

-- 2. Actualizar restricciones si la tabla ya existía anteriormente
ALTER TABLE public.users_actitud DROP CONSTRAINT IF EXISTS unique_voter_target_attitude;
ALTER TABLE public.users_actitud DROP CONSTRAINT IF EXISTS unique_voter_target;
ALTER TABLE public.users_actitud ADD CONSTRAINT unique_voter_target UNIQUE (voter_uid, target_user_id);

-- Eliminar autovotos existentes (si alguien votó en su propio perfil)
DELETE FROM public.users_actitud WHERE voter_uid = target_user_id;

-- Agregar restricción de autovoto a nivel de base de datos
ALTER TABLE public.users_actitud DROP CONSTRAINT IF EXISTS no_self_vote;
ALTER TABLE public.users_actitud ADD CONSTRAINT no_self_vote CHECK (voter_uid <> target_user_id);

-- 3. Habilitar Seguridad de Nivel de Fila (RLS)
ALTER TABLE public.users_actitud ENABLE ROW LEVEL SECURITY;

-- 4. Crear Políticas de Permisos (RLS)
DROP POLICY IF EXISTS "Lectura pública de usuarios actitud" ON public.users_actitud;
CREATE POLICY "Lectura pública de usuarios actitud"
  ON public.users_actitud FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Inserción de votos de actitud" ON public.users_actitud;
CREATE POLICY "Inserción de votos de actitud"
  ON public.users_actitud FOR INSERT
  WITH CHECK (voter_uid <> target_user_id);

DROP POLICY IF EXISTS "Actualización de votos de actitud" ON public.users_actitud;
CREATE POLICY "Actualización de votos de actitud"
  ON public.users_actitud FOR UPDATE
  USING (true)
  WITH CHECK (voter_uid <> target_user_id);

DROP POLICY IF EXISTS "Eliminación de votos de actitud" ON public.users_actitud;
CREATE POLICY "Eliminación de votos de actitud"
  ON public.users_actitud FOR DELETE
  USING (true);

-- 5. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_users_actitud_target ON public.users_actitud(target_user_id);
CREATE INDEX IF NOT EXISTS idx_users_actitud_voter_target ON public.users_actitud(voter_uid, target_user_id);
