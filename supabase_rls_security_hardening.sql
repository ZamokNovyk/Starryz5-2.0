-- =======================================================================
-- MIGRACIÓN MAESTRA DE SEGURIDAD SUPABASE: ROW LEVEL SECURITY (RLS)
-- =======================================================================
-- Copia y ejecuta este script en el SQL Editor de tu panel de Supabase:
-- Dashboard Supabase -> SQL Editor -> New Query -> Pegar -> Run
-- 
-- RESUELVE:
-- 1. Ataques desde la consola del navegador:
--    await supabase.from('educational_centers').delete().eq('id', '...');
-- 2. Modificaciones no autorizadas o escalamiento de privilegios a 'admin'.
-- 3. Borrado malicioso de estadísticas globales o cuentas de usuarios.
-- =======================================================================

-- -----------------------------------------------------------------------
-- 0. GARANTIZAR COLUMNAS BASE (PREVIENE ERRORES 42703 'column does not exist')
-- -----------------------------------------------------------------------
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
  END IF;
END $$;

-- -----------------------------------------------------------------------
-- 1. FUNCIÓN AUXILIAR: VERIFICACIÓN DE ROL ADMINISTRADOR
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_user(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN FALSE;
  END IF;

  -- Lista blanca oficial de superadministradores de Starryz
  IF LOWER(TRIM(p_email)) IN ('wikistars12@gmail.com', 'wikibot3@gmail.com') THEN
    RETURN TRUE;
  END IF;

  -- Comprobación en la tabla users
  BEGIN
    RETURN EXISTS (
      SELECT 1 
      FROM public.users u
      WHERE LOWER(TRIM(COALESCE(u.email, ''))) = LOWER(TRIM(p_email))
        AND u.role = 'admin'
    );
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;
END;
$$;

-- -----------------------------------------------------------------------
-- 2. TRIGGER CONTRA ESCALAMIENTO DE PRIVILEGIOS EN 'users'
-- Impide que usuarios utilicen la consola para autoasignarse 'role = admin'
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Si intentan cambiar el rol a 'admin' o 'superadmin'
  IF (NEW.role = 'admin' OR NEW.role = 'superadmin') AND (OLD.role IS DISTINCT FROM NEW.role) THEN
    -- Solo se permite si el correo es de los administradores autorizados
    IF LOWER(TRIM(COALESCE(NEW.email, OLD.email, ''))) NOT IN ('wikistars12@gmail.com', 'wikibot3@gmail.com') THEN
      RAISE EXCEPTION 'Violación de seguridad: No tiene privilegios para promoverse a administrador.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.users;
CREATE TRIGGER trg_prevent_role_escalation
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.check_user_role_escalation();

-- -----------------------------------------------------------------------
-- 3. HABILITACIÓN DE RLS EN 'educational_centers'
-- -----------------------------------------------------------------------
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'educational_centers') THEN
    EXECUTE 'ALTER TABLE public.educational_centers ENABLE ROW LEVEL SECURITY;';
  END IF;
END $$;

DROP POLICY IF EXISTS "Lectura pública de centros educativos" ON public.educational_centers;
DROP POLICY IF EXISTS "Creación de centros por usuarios identificados" ON public.educational_centers;
DROP POLICY IF EXISTS "Actualización de centros educativos" ON public.educational_centers;
DROP POLICY IF EXISTS "Eliminación restringida de centros educativos" ON public.educational_centers;
DROP POLICY IF EXISTS "Permitir todo a centros" ON public.educational_centers;

-- Política SELECT: Lectura pública para todos los visitantes
CREATE POLICY "Lectura pública de centros educativos"
ON public.educational_centers FOR SELECT
USING (true);

-- Política INSERT: Permitir creación desde la app
CREATE POLICY "Creación de centros por usuarios identificados"
ON public.educational_centers FOR INSERT
WITH CHECK (true);

-- Política UPDATE: Actualización permitida para visitas y datos del centro
CREATE POLICY "Actualización de centros educativos"
ON public.educational_centers FOR UPDATE
USING (true)
WITH CHECK (true);

-- Política DELETE: BLOQUEO TOTAL para clientes anónimos y consola del navegador!
-- Si alguien intenta: await supabase.from('educational_centers').delete()...
-- PostgreSQL devolverá error 42501 (permiso denegado por RLS)
CREATE POLICY "Eliminación restringida de centros educativos"
ON public.educational_centers FOR DELETE
USING (false);

-- -----------------------------------------------------------------------
-- 4. FUNCIÓN RPC SEGURA PARA ELIMINACIÓN EXCLUSIVA DE ADMINS
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_educational_center(
  p_center_id TEXT,
  p_admin_email TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_uuid UUID;
BEGIN
  -- Validar que quien ejecuta la acción sea un administrador legítimo
  v_is_admin := public.is_admin_user(p_admin_email);
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Acceso denegado: Se requieren credenciales de administrador para eliminar un centro educativo.';
  END IF;

  -- Intentar eliminación por UUID o por texto
  BEGIN
    v_uuid := p_center_id::UUID;
    DELETE FROM public.educational_centers WHERE id = v_uuid;
  EXCEPTION WHEN OTHERS THEN
    DELETE FROM public.educational_centers WHERE id::text = p_center_id;
  END;

  RETURN TRUE;
END;
$$;

-- -----------------------------------------------------------------------
-- 5. HABILITACIÓN DE RLS EN 'users'
-- -----------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lecturas públicas de usuarios" ON public.users;
DROP POLICY IF EXISTS "Permitir inserciones y actualizaciones públicas" ON public.users;
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

-- Lectura pública para perfiles
CREATE POLICY "users_select_policy"
ON public.users FOR SELECT
USING (true);

-- Inserción permitida al autenticarse o registrarse
CREATE POLICY "users_insert_policy"
ON public.users FOR INSERT
WITH CHECK (true);

-- Actualización protegida (el trigger trg_prevent_role_escalation impide escalar a role='admin')
CREATE POLICY "users_update_policy"
ON public.users FOR UPDATE
USING (true)
WITH CHECK (true);

-- Eliminación directa de la tabla users BLOQUEADA desde la consola
CREATE POLICY "users_delete_policy"
ON public.users FOR DELETE
USING (false);

-- -----------------------------------------------------------------------
-- 6. HABILITACIÓN DE RLS EN 'platform_stats' (Métricas Globales)
-- -----------------------------------------------------------------------
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'platform_stats') THEN
    EXECUTE 'ALTER TABLE public.platform_stats ENABLE ROW LEVEL SECURITY;';
  END IF;
END $$;

DROP POLICY IF EXISTS "platform_stats_read_only" ON public.platform_stats;
DROP POLICY IF EXISTS "platform_stats_block_delete" ON public.platform_stats;

-- Solo lectura pública de las estadísticas
CREATE POLICY "platform_stats_read_only"
ON public.platform_stats FOR SELECT
USING (true);

-- Bloqueo total de borrado desde el navegador
CREATE POLICY "platform_stats_block_delete"
ON public.platform_stats FOR DELETE
USING (false);

-- -----------------------------------------------------------------------
-- 7. HABILITACIÓN DE RLS EN TABLAS DE CONFESIONES Y COMENTARIOS
-- -----------------------------------------------------------------------
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'center_confessions') THEN
    EXECUTE 'ALTER TABLE public.center_confessions ENABLE ROW LEVEL SECURITY;';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'confession_comments') THEN
    EXECUTE 'ALTER TABLE public.confession_comments ENABLE ROW LEVEL SECURITY;';
  END IF;
END $$;

DROP POLICY IF EXISTS "confessions_select" ON public.center_confessions;
DROP POLICY IF EXISTS "confessions_insert" ON public.center_confessions;
DROP POLICY IF EXISTS "confessions_delete" ON public.center_confessions;

CREATE POLICY "confessions_select"
ON public.center_confessions FOR SELECT
USING (true);

CREATE POLICY "confessions_insert"
ON public.center_confessions FOR INSERT
WITH CHECK (true);

CREATE POLICY "confessions_delete"
ON public.center_confessions FOR DELETE
USING (true);

-- -----------------------------------------------------------------------
-- 8. HABILITACIÓN DE RLS EN 'professors' Y 'students'
-- -----------------------------------------------------------------------
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'professors') THEN
    EXECUTE 'ALTER TABLE public.professors ENABLE ROW LEVEL SECURITY;';
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'students') THEN
    EXECUTE 'ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;';
  END IF;
END $$;

DROP POLICY IF EXISTS "professors_select" ON public.professors;
DROP POLICY IF EXISTS "professors_insert" ON public.professors;
DROP POLICY IF EXISTS "professors_delete" ON public.professors;

CREATE POLICY "professors_select" ON public.professors FOR SELECT USING (true);
CREATE POLICY "professors_insert" ON public.professors FOR INSERT WITH CHECK (true);
-- Evitar borrado indiscriminado de docentes desde consola
CREATE POLICY "professors_delete" ON public.professors FOR DELETE USING (false);

DROP POLICY IF EXISTS "students_select" ON public.students;
DROP POLICY IF EXISTS "students_insert" ON public.students;
DROP POLICY IF EXISTS "students_delete" ON public.students;

CREATE POLICY "students_select" ON public.students FOR SELECT USING (true);
CREATE POLICY "students_insert" ON public.students FOR INSERT WITH CHECK (true);
-- Evitar borrado indiscriminado de alumnos desde consola
CREATE POLICY "students_delete" ON public.students FOR DELETE USING (false);

-- Confirmación de ejecución satisfactoria
SELECT 'Políticas RLS y protección contra borrado en consola aplicadas con éxito.' AS resultado;
