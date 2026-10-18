-- ==============================================================================
-- STARRYZ 5: MIGRACIÓN DE COLUMNAS DE ESTUDIANTES Y RECLAMACIÓN CON DNI
-- ==============================================================================
-- Copia y pega todo este script en el SQL Editor de tu panel de Supabase y presiona RUN.
-- Resuelve el error 42P16 eliminando primero la vista con DROP VIEW CASCADE.
-- ==============================================================================

-- 1. AGREGAR COLUMNAS EN LA TABLA 'students'
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS nombres TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS apellido_paterno TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS apellido_materno TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS nombre_completo TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS apellidos TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS dni TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS claimed_by_uid TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS claimed_by_name TEXT;

-- 2. AGREGAR COLUMNAS EN LA TABLA 'users'
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nombres TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS apellido_paterno TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS apellido_materno TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nombre_completo TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS apellidos TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dni TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS institute_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS claimed_student_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified_student BOOLEAN DEFAULT FALSE;

-- 3. RELLENAR Y SINCRONIZAR AUTOMÁTICAMENTE DATOS EXISTENTES EN 'students'
UPDATE public.students
SET 
  nombres = COALESCE(NULLIF(nombres, ''), NULLIF(nombre, ''), split_part(nombre_completo, ' ', 1)),
  nombre = COALESCE(NULLIF(nombre, ''), NULLIF(nombres, ''), split_part(nombre_completo, ' ', 1)),
  apellido_paterno = COALESCE(
    NULLIF(apellido_paterno, ''), 
    NULLIF(split_part(apellidos, ' ', 1), ''),
    NULLIF(split_part(nombre_completo, ' ', 2), '')
  ),
  apellido_materno = COALESCE(
    NULLIF(apellido_materno, ''), 
    NULLIF(trim(substring(apellidos from length(split_part(apellidos, ' ', 1)) + 1)), ''),
    NULLIF(split_part(nombre_completo, ' ', 3), '')
  ),
  apellidos = COALESCE(
    NULLIF(apellidos, ''),
    NULLIF(TRIM(COALESCE(apellido_paterno, '') || ' ' || COALESCE(apellido_materno, '')), '')
  ),
  nombre_completo = COALESCE(
    NULLIF(nombre_completo, ''),
    TRIM(COALESCE(nombre, nombres, '') || ' ' || COALESCE(apellidos, ''))
  );

-- 4. RELLENAR Y SINCRONIZAR AUTOMÁTICAMENTE DATOS EXISTENTES EN 'users'
UPDATE public.users
SET 
  nombre = COALESCE(NULLIF(nombre, ''), NULLIF(nombres, ''), split_part(display_name, ' ', 1)),
  nombres = COALESCE(NULLIF(nombres, ''), NULLIF(nombre, ''), split_part(display_name, ' ', 1)),
  apellido_paterno = COALESCE(
    NULLIF(apellido_paterno, ''),
    NULLIF(split_part(apellidos, ' ', 1), ''),
    NULLIF(split_part(display_name, ' ', 2), '')
  ),
  apellido_materno = COALESCE(
    NULLIF(apellido_materno, ''),
    NULLIF(trim(substring(apellidos from length(split_part(apellidos, ' ', 1)) + 1)), ''),
    NULLIF(split_part(display_name, ' ', 3), '')
  ),
  apellidos = COALESCE(
    NULLIF(apellidos, ''),
    NULLIF(TRIM(COALESCE(apellido_paterno, '') || ' ' || COALESCE(apellido_materno, '')), '')
  ),
  nombre_completo = COALESCE(
    NULLIF(nombre_completo, ''),
    NULLIF(display_name, ''),
    TRIM(COALESCE(nombres, nombre, '') || ' ' || COALESCE(apellidos, ''))
  );

-- 5. TRIGGER DE AUTO-SINCRONIZACIÓN PARA NUEVOS ESTUDIANTES O ACTUALIZACIONES
CREATE OR REPLACE FUNCTION public.sync_student_names_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.nombres IS NULL OR NEW.nombres = '' THEN
    NEW.nombres := NEW.nombre;
  END IF;
  IF NEW.nombre IS NULL OR NEW.nombre = '' THEN
    NEW.nombre := NEW.nombres;
  END IF;

  IF (NEW.apellido_paterno IS NULL OR NEW.apellido_paterno = '') AND (NEW.apellidos IS NOT NULL AND NEW.apellidos <> '') THEN
    NEW.apellido_paterno := split_part(NEW.apellidos, ' ', 1);
    NEW.apellido_materno := NULLIF(trim(substring(NEW.apellidos from length(split_part(NEW.apellidos, ' ', 1)) + 1)), '');
  END IF;

  IF (NEW.apellidos IS NULL OR NEW.apellidos = '') THEN
    NEW.apellidos := TRIM(COALESCE(NEW.apellido_paterno, '') || ' ' || COALESCE(NEW.apellido_materno, ''));
  END IF;

  IF NEW.nombre_completo IS NULL OR NEW.nombre_completo = '' THEN
    NEW.nombre_completo := TRIM(COALESCE(NEW.nombre, NEW.nombres, '') || ' ' || COALESCE(NEW.apellidos, ''));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_student_names ON public.students;
CREATE TRIGGER trg_sync_student_names
BEFORE INSERT OR UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.sync_student_names_trigger();

-- 6. ELIMINAR Y RECREAR LA VISTA 'institute_students_view' (Con security_invoker = true)
DROP VIEW IF EXISTS public.institute_students_view CASCADE;

CREATE VIEW public.institute_students_view 
WITH (security_invoker = true) AS
SELECT 
    s.id AS id,
    s.id AS student_id,
    s.id AS profile_slug,
    COALESCE(s.nombres, s.nombre, '') AS nombres,
    COALESCE(s.nombre, s.nombres, '') AS nombre,
    COALESCE(s.apellidos, TRIM(COALESCE(s.apellido_paterno, '') || ' ' || COALESCE(s.apellido_materno, ''))) AS apellidos,
    COALESCE(s.apellido_paterno, split_part(s.apellidos, ' ', 1)) AS apellido_paterno,
    COALESCE(s.apellido_materno, NULLIF(trim(substring(s.apellidos from length(split_part(s.apellidos, ' ', 1)) + 1)), '')) AS apellido_materno,
    COALESCE(s.nombre_completo, TRIM(COALESCE(s.nombre, s.nombres, '') || ' ' || COALESCE(s.apellidos, ''))) AS nombre_completo,
    s.institute_id::text AS institute_id,
    s.avatar_url,
    COALESCE(s.score, 0) AS score,
    COALESCE(s.total_ratings, 0) AS total_ratings,
    COALESCE(s.views_count, 0) AS views_count,
    COALESCE(s.fans_count, 0) AS fans_count,
    COALESCE(s.knows_count, 0) AS knows_count,
    COALESCE(s.crushes_count, 0) AS crushes_count,
    COALESCE(s.dni, '') AS dni,
    COALESCE(s.is_claimed, false) AS is_claimed,
    s.claimed_by_uid AS user_uuid,
    s.created_at
FROM public.students s;

-- 7. GARANTIZAR PERMISOS Y POLÍTICAS RLS PARA LECTURAS Y RECLAMOS
GRANT SELECT ON public.students TO anon, authenticated;
GRANT SELECT ON public.users TO anon, authenticated;
GRANT SELECT ON public.institute_students_view TO anon, authenticated;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica de estudiantes" ON public.students;
CREATE POLICY "Lectura publica de estudiantes" ON public.students FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir actualizar reclamos de estudiantes" ON public.students;
CREATE POLICY "Permitir actualizar reclamos de estudiantes" ON public.students FOR UPDATE USING (true) WITH CHECK (true);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lectura publica de usuarios" ON public.users;
CREATE POLICY "Lectura publica de usuarios" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir actualizar usuarios" ON public.users;
CREATE POLICY "Permitir actualizar usuarios" ON public.users FOR UPDATE USING (true) WITH CHECK (true);
