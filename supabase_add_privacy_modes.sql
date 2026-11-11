-- ============================================================================
-- SCRIPT DE MIGRACIÓN SUPABASE: MODOS DE PRIVACIDAD EN 'users'
-- Agrega columnas saved_mode, interactions_mode, subscriptions_mode
-- Por defecto en 'solo_yo' para mantener la privacidad del usuario
-- ============================================================================

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS saved_mode TEXT DEFAULT 'solo_yo',
ADD COLUMN IF NOT EXISTS interactions_mode TEXT DEFAULT 'solo_yo',
ADD COLUMN IF NOT EXISTS subscriptions_mode TEXT DEFAULT 'solo_yo';

-- Actualizar usuarios existentes para que tengan 'solo_yo' por defecto
UPDATE public.users 
SET 
  saved_mode = COALESCE(saved_mode, 'solo_yo'),
  interactions_mode = COALESCE(interactions_mode, 'solo_yo'),
  subscriptions_mode = COALESCE(subscriptions_mode, 'solo_yo');

-- Recargar esquema en PostgREST
NOTIFY pgrst, 'reload schema';
