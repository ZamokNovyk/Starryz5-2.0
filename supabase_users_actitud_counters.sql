-- ============================================================================
-- SCRIPT DE MIGRACIÓN SUPABASE (CORREGIDO DE TIPOS: text = uuid)
-- Copia y ejecuta todo este bloque en el SQL Editor de tu Dashboard de Supabase.
-- ============================================================================

-- 1. Agregar las columnas de contadores a la tabla 'users'
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS knows_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fans_count INTEGER DEFAULT 0;

-- 2. Crear función Trigger para recalcular y sincronizar automáticamente en 'users'
CREATE OR REPLACE FUNCTION public.sync_users_actitud_counts()
RETURNS TRIGGER AS $$
DECLARE
  target_id TEXT;
BEGIN
  target_id := COALESCE(NEW.target_user_id, OLD.target_user_id);
  
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

-- 3. Vincular el Trigger a la tabla 'users_actitud'
DROP TRIGGER IF EXISTS trigger_sync_users_actitud_counts ON public.users_actitud;
CREATE TRIGGER trigger_sync_users_actitud_counts
AFTER INSERT OR UPDATE OR DELETE ON public.users_actitud
FOR EACH ROW
EXECUTE FUNCTION public.sync_users_actitud_counts();

-- 4. Recalcular contadores existentes para todos los usuarios actuales
UPDATE public.users u
SET 
  knows_count = (
    SELECT COUNT(*) FROM public.users_actitud a 
    WHERE a.target_user_id = u.id::text AND a.attitude_type = 'yo_te_conozco'
  ),
  fans_count = (
    SELECT COUNT(*) FROM public.users_actitud a 
    WHERE a.target_user_id = u.id::text AND a.attitude_type = 'fans'
  );
