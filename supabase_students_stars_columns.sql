-- ============================================================================
-- MIGRACIÓN SUPABASE: 5 COLUMNAS DE ESTRELLAS EN LA TABLA 'students'
-- Agrega stars_1, stars_2, stars_3, stars_4, stars_5 (int4 / integer default 0)
-- y sincroniza el registro general de estrellas desde 'user_reseñas'.
-- Copia y ejecuta todo este script en el SQL Editor de tu Dashboard de Supabase.
-- ============================================================================

-- 1. Agregar las 5 columnas de estrellas a la tabla 'students'
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS stars_1 INTEGER DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS stars_2 INTEGER DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS stars_3 INTEGER DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS stars_4 INTEGER DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS stars_5 INTEGER DEFAULT 0;

-- 2. Asegurarse de que las filas existentes no tengan valores NULL
UPDATE public.students
SET 
  stars_1 = COALESCE(stars_1, 0),
  stars_2 = COALESCE(stars_2, 0),
  stars_3 = COALESCE(stars_3, 0),
  stars_4 = COALESCE(stars_4, 0),
  stars_5 = COALESCE(stars_5, 0);

-- 3. Función Trigger para sincronizar automáticamente el conteo general de estrellas,
-- total_ratings y score en la tabla 'students' cada vez que alguien califica en 'user_reseñas'.
CREATE OR REPLACE FUNCTION public.sync_student_stars_distribution()
RETURNS TRIGGER AS $$
DECLARE
  target_id TEXT;
  total_count INT;
  calc_score NUMERIC;
BEGIN
  target_id := COALESCE(NEW.target_user_id, OLD.target_user_id);

  IF target_id IS NOT NULL AND target_id <> '' THEN
    SELECT COUNT(*), COALESCE(ROUND(AVG(stars::numeric), 1), 0.0)
    INTO total_count, calc_score
    FROM public.user_reseñas
    WHERE target_user_id = target_id;

    UPDATE public.students
    SET 
      stars_1 = (SELECT COUNT(*) FROM public.user_reseñas WHERE target_user_id = target_id AND ROUND(stars::numeric) = 1),
      stars_2 = (SELECT COUNT(*) FROM public.user_reseñas WHERE target_user_id = target_id AND ROUND(stars::numeric) = 2),
      stars_3 = (SELECT COUNT(*) FROM public.user_reseñas WHERE target_user_id = target_id AND ROUND(stars::numeric) = 3),
      stars_4 = (SELECT COUNT(*) FROM public.user_reseñas WHERE target_user_id = target_id AND ROUND(stars::numeric) = 4),
      stars_5 = (SELECT COUNT(*) FROM public.user_reseñas WHERE target_user_id = target_id AND ROUND(stars::numeric) = 5),
      total_ratings = total_count,
      score = calc_score
    WHERE id::text = target_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Vincular el Trigger a la tabla 'user_reseñas'
DROP TRIGGER IF EXISTS trigger_sync_student_stars ON public.user_reseñas;
CREATE TRIGGER trigger_sync_student_stars
AFTER INSERT OR UPDATE OR DELETE ON public.user_reseñas
FOR EACH ROW
EXECUTE FUNCTION public.sync_student_stars_distribution();

-- 5. Recalcular la distribución de estrellas para todos los estudiantes actuales
UPDATE public.students s
SET 
  stars_1 = (SELECT COUNT(*) FROM public.user_reseñas r WHERE r.target_user_id = s.id::text AND ROUND(r.stars::numeric) = 1),
  stars_2 = (SELECT COUNT(*) FROM public.user_reseñas r WHERE r.target_user_id = s.id::text AND ROUND(r.stars::numeric) = 2),
  stars_3 = (SELECT COUNT(*) FROM public.user_reseñas r WHERE r.target_user_id = s.id::text AND ROUND(r.stars::numeric) = 3),
  stars_4 = (SELECT COUNT(*) FROM public.user_reseñas r WHERE r.target_user_id = s.id::text AND ROUND(r.stars::numeric) = 4),
  stars_5 = (SELECT COUNT(*) FROM public.user_reseñas r WHERE r.target_user_id = s.id::text AND ROUND(r.stars::numeric) = 5),
  total_ratings = (SELECT COUNT(*) FROM public.user_reseñas r WHERE r.target_user_id = s.id::text),
  score = COALESCE((SELECT ROUND(AVG(r.stars::numeric), 1) FROM public.user_reseñas r WHERE r.target_user_id = s.id::text), 0.0);
