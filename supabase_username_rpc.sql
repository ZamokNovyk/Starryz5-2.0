-- =======================================================================
-- RPC SUPABASE: VALIDACIÓN DE NOMBRE DE USUARIO / APODO ÚNICO
-- =======================================================================
-- Copia y ejecuta este script en el SQL Editor de tu panel de Supabase.

-- 1. Asegurar restricción o índice único insensible a mayúsculas/minúsculas en 'users'
-- Si la tabla users tiene 'display_name' y/o 'username':
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_name_unique_lower 
ON public.users (LOWER(TRIM(display_name)));

-- 2. Función RPC: check_username_available
-- Recibe el nuevo nombre y los identificadores opcionales del usuario actual
-- Retorna TRUE si el nombre está libre, o FALSE si ya está ocupado por otro usuario.
CREATE OR REPLACE FUNCTION public.check_username_available(
  p_username text,
  p_user_id text DEFAULT NULL,
  p_firebase_uid text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cleaned text;
  v_exists boolean;
BEGIN
  -- Limpiar espacios al inicio y final
  v_cleaned := TRIM(COALESCE(p_username, ''));

  -- Validación de longitud mínima y no vacío
  IF v_cleaned = '' OR LENGTH(v_cleaned) < 2 THEN
    RETURN false;
  END IF;

  -- Comprobar si existe otro registro con el mismo nombre (insensible a mayúsculas)
  SELECT EXISTS(
    SELECT 1 
    FROM public.users u
    WHERE 
      LOWER(TRIM(COALESCE(u.display_name, ''))) = LOWER(v_cleaned)
      AND (p_firebase_uid IS NULL OR u.firebase_uid <> p_firebase_uid)
      AND (p_user_id IS NULL OR u.id::text <> p_user_id)
  ) INTO v_exists;

  -- Retorna TRUE si NO existe (está disponible), o FALSE si ya existe (ocupado)
  RETURN NOT v_exists;
END;
$$;
