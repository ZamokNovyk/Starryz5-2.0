-- ==============================================================================
-- MIGRACIÓN DE SUPABASE: ESTRUCTURACIÓN DE NOMBRES Y APELLIDOS EN TABLA 'users'
-- ==============================================================================
-- Copia y pega este script en el SQL Editor de tu panel de control de Supabase 
-- (https://supabase.com/dashboard/project/_/sql) y haz clic en "RUN".
-- ==============================================================================

-- 1. Agregar las 3 columnas estructuradas a la tabla 'users'
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS nombres text,
ADD COLUMN IF NOT EXISTS apellido_paterno text,
ADD COLUMN IF NOT EXISTS apellido_materno text;

-- 2. Migrar y rellenar automáticamente los datos de los usuarios existentes a partir de su 'display_name'
DO $$
DECLARE
    r RECORD;
    v_parts text[];
    v_len int;
    v_nombres text;
    v_paterno text;
    v_materno text;
BEGIN
    FOR r IN SELECT id, display_name FROM public.users WHERE display_name IS NOT NULL AND display_name != '' LOOP
        v_parts := regexp_split_to_array(trim(r.display_name), '\s+');
        v_len := array_length(v_parts, 1);

        IF v_len = 1 THEN
            v_nombres := v_parts[1];
            v_paterno := '';
            v_materno := '';
        ELSIF v_len = 2 THEN
            v_nombres := v_parts[1];
            v_paterno := v_parts[2];
            v_materno := '';
        ELSIF v_len = 3 THEN
            v_nombres := v_parts[1];
            v_paterno := v_parts[2];
            v_materno := v_parts[3];
        ELSE
            -- 4 o más palabras (ej: Daniel Gustavo Castillo Ramirez)
            v_nombres := array_to_string(v_parts[1:v_len-2], ' ');
            v_paterno := v_parts[v_len-1];
            v_materno := v_parts[v_len];
        END IF;

        UPDATE public.users 
        SET 
            nombres = COALESCE(users.nombres, v_nombres),
            apellido_paterno = COALESCE(users.apellido_paterno, v_paterno),
            apellido_materno = COALESCE(users.apellido_materno, v_materno)
        WHERE id = r.id;
    END LOOP;
END $$;

-- 3. Crear índices de búsqueda rápida trigramática en las nuevas columnas
CREATE INDEX IF NOT EXISTS idx_users_nombres_trgm 
ON public.users USING gin (nombres gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_apellido_paterno_trgm 
ON public.users USING gin (apellido_paterno gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_apellido_materno_trgm 
ON public.users USING gin (apellido_materno gin_trgm_ops);

-- ==============================================================================
-- ¡Listo! Ahora la tabla 'public.users' tiene nombres, apellido_paterno y apellido_materno.
-- ==============================================================================
