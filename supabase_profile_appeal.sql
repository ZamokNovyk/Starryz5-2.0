-- ==============================================================================
-- STARRYZ 5: COLUMNA PROFILE_APPEAL E INSTIGACIÓN DE RECLAMOS
-- ==============================================================================
-- Copia y pega este script en el SQL Editor de tu panel de Supabase y pulsa RUN.
-- Agrega la columna 'profile_appeal' en la tabla users y asegura que:
-- 1. Solo los usuarios que han reclamado un perfil tengan profile_appeal = TRUE y su institute_id correspondiente.
-- 2. Los usuarios normales (que no han reclamado perfil) tengan institute_id = NULL y profile_appeal = FALSE.
-- ==============================================================================

-- 1. AGREGAR COLUMNA 'profile_appeal' EN LA TABLA 'users'
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS profile_appeal BOOLEAN DEFAULT FALSE;

-- 2. SINCRONIZAR ESTADO ACTUAL:
-- Si ya tiene un perfil oficial reclamado (claimed_student_id no nulo):
UPDATE public.users
SET 
  profile_appeal = TRUE,
  institute_id = COALESCE(institute_id, '9029cbec-ead6-48ae-aace-3c348b0dc325')
WHERE claimed_student_id IS NOT NULL;

-- Si no ha reclamado perfil:
UPDATE public.users
SET 
  profile_appeal = FALSE,
  institute_id = NULL
WHERE claimed_student_id IS NULL;

-- 3. VERIFICAR RESULTADO
SELECT id, email, display_name, dni, institute_id, profile_appeal, claimed_student_id 
FROM public.users 
LIMIT 10;
