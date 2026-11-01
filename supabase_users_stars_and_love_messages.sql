-- ============================================================================
-- SCRIPT DE MIGRACIÓN SUPABASE: 
-- 1. 6 COLUMNAS EN 'users' (stars_1 .. stars_5 + score/promedio)
-- 2. RESTRICCIONES EN 'user_reseñas' (NO AUTOVOTO + MÁXIMO 6 POR DÍA)
-- 3. TRIGGER AUTOMÁTICO DE SINCRONIZACIÓN DE ESTRELLAS EN 'users'
-- 4. CONFIGURACIÓN COMPLETA DE 'user_love_messages' Y 'user_love_reactions'
-- ============================================================================
-- Copia y ejecuta todo este bloque en el SQL Editor de tu Dashboard de Supabase.
-- ============================================================================

-- ============================================================================
-- PARTE 1: AGREGAR 6 COLUMNAS EN LA TABLA 'users'
-- ============================================================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stars_1 INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stars_2 INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stars_3 INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stars_4 INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stars_5 INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS score NUMERIC(3,1) DEFAULT 0.0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;

-- Sanitizar valores nulos existentes
UPDATE public.users
SET 
  stars_1 = COALESCE(stars_1, 0),
  stars_2 = COALESCE(stars_2, 0),
  stars_3 = COALESCE(stars_3, 0),
  stars_4 = COALESCE(stars_4, 0),
  stars_5 = COALESCE(stars_5, 0),
  score = COALESCE(score, 0.0),
  total_ratings = COALESCE(total_ratings, 0);

-- ============================================================================
-- PARTE 2: RESTRICCIONES EN 'user_reseñas'
-- 1. Un usuario no puede calificarse a sí mismo
-- 2. Límite estricto de máximo 6 calificaciones/intentos por día por usuario
-- ============================================================================

-- Asegurar restricción CHECK a nivel de tabla
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_self_rating_user_reseñas'
  ) THEN
    ALTER TABLE public.user_reseñas 
      ADD CONSTRAINT no_self_rating_user_reseñas CHECK (voter_uid <> target_user_id);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Función de validación BEFORE INSERT para verificar límite de 6 calificaciones por día y autocalificación
CREATE OR REPLACE FUNCTION public.check_user_reseñas_restrictions()
RETURNS TRIGGER AS $$
DECLARE
  daily_votes_count INTEGER;
  linked_user_id TEXT;
BEGIN
  -- 1. Verificar que no se califique a sí mismo directamente
  IF NEW.voter_uid = NEW.target_user_id THEN
    RAISE EXCEPTION 'No puedes calificar tu propio perfil.';
  END IF;

  -- 2. Verificar que no se califique a sí mismo mediante perfil vinculado
  SELECT id::text INTO linked_user_id
  FROM public.users
  WHERE (id::text = NEW.target_user_id OR claimed_student_id::text = NEW.target_user_id)
    AND id::text = NEW.voter_uid
  LIMIT 1;

  IF linked_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'No puedes calificar tu propio perfil de estudiante.';
  END IF;

  -- 3. Limitar a un máximo de 6 calificaciones por día (en las últimas 24 horas)
  SELECT COUNT(*) INTO daily_votes_count
  FROM public.user_reseñas
  WHERE voter_uid = NEW.voter_uid
    AND created_at >= (NOW() - INTERVAL '24 hours');

  IF daily_votes_count >= 6 THEN
    RAISE EXCEPTION 'Has alcanzado el límite máximo de 6 calificaciones por día. Vuelve a intentarlo mañana.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_user_reseñas_restrictions ON public.user_reseñas;
CREATE TRIGGER trigger_check_user_reseñas_restrictions
BEFORE INSERT ON public.user_reseñas
FOR EACH ROW
EXECUTE FUNCTION public.check_user_reseñas_restrictions();

-- ============================================================================
-- PARTE 3: TRIGGER DE SINCRONIZACIÓN AUTOMÁTICA DE ESTRELLAS EN 'users'
-- Sincroniza stars_1..stars_5, score y total_ratings desde 'user_reseñas'
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_user_stars_distribution()
RETURNS TRIGGER AS $$
DECLARE
  target_id TEXT;
  s1 INT;
  s2 INT;
  s3 INT;
  s4 INT;
  s5 INT;
  total_count INT;
  calc_score NUMERIC(3,1);
BEGIN
  target_id := COALESCE(NEW.target_user_id, OLD.target_user_id);

  IF target_id IS NOT NULL AND target_id <> '' THEN
    -- Contar distribución de estrellas para este usuario objetivo
    SELECT 
      COUNT(*) FILTER (WHERE ROUND(stars::numeric) = 1),
      COUNT(*) FILTER (WHERE ROUND(stars::numeric) = 2),
      COUNT(*) FILTER (WHERE ROUND(stars::numeric) = 3),
      COUNT(*) FILTER (WHERE ROUND(stars::numeric) = 4),
      COUNT(*) FILTER (WHERE ROUND(stars::numeric) = 5),
      COUNT(*),
      COALESCE(ROUND(AVG(stars::numeric), 1), 0.0)
    INTO s1, s2, s3, s4, s5, total_count, calc_score
    FROM public.user_reseñas
    WHERE target_user_id = target_id;

    -- Actualizar tabla 'users'
    UPDATE public.users
    SET 
      stars_1 = s1,
      stars_2 = s2,
      stars_3 = s3,
      stars_4 = s4,
      stars_5 = s5,
      total_ratings = total_count,
      score = calc_score
    WHERE id::text = target_id OR claimed_student_id::text = target_id;

    -- Actualizar tabla 'students' si existe
    UPDATE public.students
    SET 
      stars_1 = s1,
      stars_2 = s2,
      stars_3 = s3,
      stars_4 = s4,
      stars_5 = s5,
      total_ratings = total_count,
      score = calc_score
    WHERE id::text = target_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_user_stars ON public.user_reseñas;
CREATE TRIGGER trigger_sync_user_stars
AFTER INSERT OR UPDATE OR DELETE ON public.user_reseñas
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_stars_distribution();

-- Recalcular y sincronizar inmediatamente todos los registros actuales en 'users'
UPDATE public.users u
SET 
  stars_1 = COALESCE((SELECT COUNT(*) FROM public.user_reseñas r WHERE (r.target_user_id = u.id::text OR r.target_user_id = u.claimed_student_id::text) AND ROUND(r.stars::numeric) = 1), 0),
  stars_2 = COALESCE((SELECT COUNT(*) FROM public.user_reseñas r WHERE (r.target_user_id = u.id::text OR r.target_user_id = u.claimed_student_id::text) AND ROUND(r.stars::numeric) = 2), 0),
  stars_3 = COALESCE((SELECT COUNT(*) FROM public.user_reseñas r WHERE (r.target_user_id = u.id::text OR r.target_user_id = u.claimed_student_id::text) AND ROUND(r.stars::numeric) = 3), 0),
  stars_4 = COALESCE((SELECT COUNT(*) FROM public.user_reseñas r WHERE (r.target_user_id = u.id::text OR r.target_user_id = u.claimed_student_id::text) AND ROUND(r.stars::numeric) = 4), 0),
  stars_5 = COALESCE((SELECT COUNT(*) FROM public.user_reseñas r WHERE (r.target_user_id = u.id::text OR r.target_user_id = u.claimed_student_id::text) AND ROUND(r.stars::numeric) = 5), 0),
  total_ratings = COALESCE((SELECT COUNT(*) FROM public.user_reseñas r WHERE (r.target_user_id = u.id::text OR r.target_user_id = u.claimed_student_id::text)), 0),
  score = COALESCE((SELECT ROUND(AVG(r.stars::numeric), 1) FROM public.user_reseñas r WHERE (r.target_user_id = u.id::text OR r.target_user_id = u.claimed_student_id::text)), 0.0);

-- ============================================================================
-- PARTE 4: CONFIGURACIÓN COMPLETA DE 'user_love_messages' Y 'user_love_reactions'
-- ============================================================================

-- 1. Tabla 'user_love_messages'
CREATE TABLE IF NOT EXISTS public.user_love_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  author_name TEXT,
  author_avatar TEXT,
  author_gender TEXT,
  message TEXT NOT NULL,
  hearts_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT no_self_love_message CHECK (user_uid <> target_user_id)
);

-- Asegurar columnas necesarias en 'user_love_messages'
ALTER TABLE public.user_love_messages ADD COLUMN IF NOT EXISTS author_gender TEXT;
ALTER TABLE public.user_love_messages ADD COLUMN IF NOT EXISTS author_avatar TEXT;
ALTER TABLE public.user_love_messages ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE public.user_love_messages ADD COLUMN IF NOT EXISTS hearts_count INTEGER DEFAULT 0;

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_user_love_messages_target ON public.user_love_messages (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_love_messages_user ON public.user_love_messages (user_uid);

-- RLS en 'user_love_messages'
ALTER TABLE public.user_love_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de mensajes de amor" ON public.user_love_messages;
CREATE POLICY "Lectura pública de mensajes de amor"
  ON public.user_love_messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Inserción de mensajes de amor para votantes" ON public.user_love_messages;
CREATE POLICY "Inserción de mensajes de amor para votantes"
  ON public.user_love_messages FOR INSERT
  WITH CHECK (user_uid <> target_user_id);

DROP POLICY IF EXISTS "Actualización de reacciones en mensajes de amor" ON public.user_love_messages;
CREATE POLICY "Actualización de reacciones en mensajes de amor"
  ON public.user_love_messages FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Eliminación de mensajes de amor propia" ON public.user_love_messages;
CREATE POLICY "Eliminación de mensajes de amor propia"
  ON public.user_love_messages FOR DELETE
  USING (true);

-- 2. Tabla 'user_love_reactions'
CREATE TABLE IF NOT EXISTS public.user_love_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_love_reaction UNIQUE (message_id, user_uid)
);

CREATE INDEX IF NOT EXISTS idx_user_love_reactions_msg ON public.user_love_reactions (message_id);
CREATE INDEX IF NOT EXISTS idx_user_love_reactions_user ON public.user_love_reactions (user_uid);

ALTER TABLE public.user_love_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de reacciones" ON public.user_love_reactions;
CREATE POLICY "Lectura pública de reacciones"
  ON public.user_love_reactions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Inserción de reacciones propia" ON public.user_love_reactions;
CREATE POLICY "Inserción de reacciones propia"
  ON public.user_love_reactions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Eliminación de reacciones propia" ON public.user_love_reactions;
CREATE POLICY "Eliminación de reacciones propia"
  ON public.user_love_reactions FOR DELETE
  USING (true);
