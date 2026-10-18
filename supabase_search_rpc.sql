-- =======================================================================
-- MIGRACIÓN DE BÚSQUEDA AVANZADA CON TOLERANCIA A ERRORES (pg_trgm)
-- =======================================================================
-- Copia y ejecuta este script en el SQL Editor de tu panel de Supabase.

-- 1. Habilitar la extensión oficial de PostgreSQL para similitud trigramática
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Índices GiST / GIN para acelerar las búsquedas difusas (Fuzzy Search)
CREATE INDEX IF NOT EXISTS idx_professors_nombre_completo_trgm 
ON public.professors USING gin (nombre_completo gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_professors_nombre_trgm 
ON public.professors USING gin (nombre gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_professors_apellidos_trgm 
ON public.professors USING gin (apellidos gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_educational_centers_name_trgm 
ON public.educational_centers USING gin (name gin_trgm_ops);

-- 3. Función RPC: buscar_con_tolerancia
-- Recibe el término buscado y un umbral opcional (por defecto 0.25)
-- Devuelve los resultados de profesores, alumnos y centros educativos registrados en Supabase.
CREATE OR REPLACE FUNCTION public.buscar_con_tolerancia(
  busqueda text,
  umbral double precision DEFAULT 0.25
)
RETURNS TABLE (
  id text,
  name text,
  type text,
  subtitle text,
  avatar_url text,
  similarity_score double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Establecer el límite de similitud trigramática
  PERFORM set_limit(umbral::real);

  RETURN QUERY
  WITH matches AS (
    -- Búsqueda en Profesores y Alumnos (tabla 'professors')
    SELECT 
      p.id::text AS id,
      COALESCE(p.nombre_completo, TRIM(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellidos, '')), p.id)::text AS name,
      CASE 
        WHEN p.role = 'Alumno' THEN 'student'::text 
        ELSE 'professor'::text 
      END AS type,
      CASE 
        WHEN p.role = 'Alumno' THEN 'Estudiante de la comunidad'::text
        ELSE COALESCE(p.institute_id, 'Docente Académico')::text
      END AS subtitle,
      COALESCE(p.avatar_url, '')::text AS avatar_url,
      GREATEST(
        similarity(COALESCE(p.nombre_completo, TRIM(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellidos, ''))), busqueda),
        similarity(COALESCE(p.nombre, ''), busqueda),
        similarity(COALESCE(p.apellidos, ''), busqueda),
        similarity(COALESCE(p.id, ''), busqueda)
      )::double precision AS similarity_score
    FROM public.professors p
    WHERE 
      similarity(COALESCE(p.nombre_completo, TRIM(COALESCE(p.nombre, '') || ' ' || COALESCE(p.apellidos, ''))), busqueda) > umbral
      OR similarity(COALESCE(p.nombre, ''), busqueda) > umbral
      OR similarity(COALESCE(p.apellidos, ''), busqueda) > umbral
      OR similarity(COALESCE(p.id, ''), busqueda) > umbral
      OR COALESCE(p.nombre_completo, '') ILIKE '%' || busqueda || '%'
      OR COALESCE(p.nombre, '') ILIKE '%' || busqueda || '%'
      OR COALESCE(p.apellidos, '') ILIKE '%' || busqueda || '%'
      OR COALESCE(p.id, '') ILIKE '%' || busqueda || '%'

    UNION ALL

    -- Búsqueda en Usuarios Registrados (tabla 'users')
    SELECT 
      u.firebase_uid::text AS id,
      COALESCE(
        NULLIF(TRIM(COALESCE(u.nombres, '') || ' ' || COALESCE(u.apellido_paterno, '') || ' ' || COALESCE(u.apellido_materno, '')), ''),
        u.display_name, 
        SPLIT_PART(COALESCE(u.email, 'Usuario'), '@', 1)
      )::text AS name,
      'student'::text AS type,
      CASE 
        WHEN u.claimed_student_id IS NOT NULL THEN 'Estudiante Verificado'::text
        WHEN u.role = 'admin' THEN 'Administrador'::text
        ELSE 'Usuario de Starryz'::text
      END AS subtitle,
      COALESCE(u.photo_url, '')::text AS avatar_url,
      GREATEST(
        similarity(COALESCE(u.nombres, ''), busqueda),
        similarity(COALESCE(u.apellido_paterno, ''), busqueda),
        similarity(COALESCE(u.apellido_materno, ''), busqueda),
        similarity(COALESCE(u.display_name, ''), busqueda),
        similarity(COALESCE(u.email, ''), busqueda)
      )::double precision AS similarity_score
    FROM public.users u
    WHERE 
      (u.display_name IS NOT NULL OR u.nombres IS NOT NULL OR u.email IS NOT NULL)
      AND (
        similarity(COALESCE(u.nombres, ''), busqueda) > umbral
        OR similarity(COALESCE(u.apellido_paterno, ''), busqueda) > umbral
        OR similarity(COALESCE(u.apellido_materno, ''), busqueda) > umbral
        OR similarity(COALESCE(u.display_name, ''), busqueda) > umbral
        OR COALESCE(u.nombres, '') ILIKE '%' || busqueda || '%'
        OR COALESCE(u.apellido_paterno, '') ILIKE '%' || busqueda || '%'
        OR COALESCE(u.apellido_materno, '') ILIKE '%' || busqueda || '%'
        OR COALESCE(u.display_name, '') ILIKE '%' || busqueda || '%'
        OR COALESCE(u.email, '') ILIKE '%' || busqueda || '%'
      )

    UNION ALL

    -- Búsqueda en Directorio Oficial de Estudiantes (tabla 'students')
    SELECT 
      s.id::text AS id,
      COALESCE(s.nombre_completo, TRIM(COALESCE(s.nombre, '') || ' ' || COALESCE(s.apellidos, '')), s.id)::text AS name,
      'student'::text AS type,
      COALESCE(s.institute_id, 'Estudiante del Instituto')::text AS subtitle,
      COALESCE(s.avatar_url, '')::text AS avatar_url,
      GREATEST(
        similarity(COALESCE(s.nombre_completo, TRIM(COALESCE(s.nombre, '') || ' ' || COALESCE(s.apellidos, ''))), busqueda),
        similarity(COALESCE(s.nombre, ''), busqueda),
        similarity(COALESCE(s.apellidos, ''), busqueda)
      )::double precision AS similarity_score
    FROM public.students s
    WHERE 
      similarity(COALESCE(s.nombre_completo, TRIM(COALESCE(s.nombre, '') || ' ' || COALESCE(s.apellidos, ''))), busqueda) > umbral
      OR similarity(COALESCE(s.nombre, ''), busqueda) > umbral
      OR similarity(COALESCE(s.apellidos, ''), busqueda) > umbral
      OR COALESCE(s.nombre_completo, '') ILIKE '%' || busqueda || '%'
      OR COALESCE(s.nombre, '') ILIKE '%' || busqueda || '%'
      OR COALESCE(s.apellidos, '') ILIKE '%' || busqueda || '%'

    UNION ALL

    -- Búsqueda en Centros Educativos (tabla 'educational_centers')
    SELECT 
      c.id::text AS id,
      c.name::text AS name,
      'center'::text AS type,
      UPPER(COALESCE(c.type, 'Centro Educativo'))::text AS subtitle,
      COALESCE(c.profile_photo_url, '')::text AS avatar_url,
      similarity(c.name, busqueda)::double precision AS similarity_score
    FROM public.educational_centers c
    WHERE 
      similarity(c.name, busqueda) > umbral
      OR c.name ILIKE '%' || busqueda || '%'
  )
  SELECT 
    m.id,
    m.name,
    m.type,
    m.subtitle,
    m.avatar_url,
    m.similarity_score
  FROM matches m
  ORDER BY m.similarity_score DESC
  LIMIT 10;
END;
$$;
