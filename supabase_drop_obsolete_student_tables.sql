-- ==============================================================================
-- SCRIPT DE ELIMINACIÓN SEGURA DE TABLAS OBSOLETAS DE STUDENTS
-- ==============================================================================
-- Este script realiza 2 pasos:
-- 1. Asegura que cualquier dato residual en las tablas antiguas 'student_*' 
--    se migre a sus versiones definitivas de usuario ('users_actitud', 'users_crushes', etc.).
-- 2. ELIMINA definitivamente (DROP TABLE CASCADE) las 5 tablas antiguas para que 
--    nunca más causen interferencias ni guarden datos allí.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PASO 1: MIGRAR RESIDUALES ANTES DE ELIMINAR (Protección de datos)
-- ------------------------------------------------------------------------------

-- A. Migrar residuales de student_interactions -> users_actitud
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_interactions') THEN
        INSERT INTO public.users_actitud (voter_uid, target_user_id, attitude_type, created_at)
        SELECT 
            si.user_uid, 
            si.student_id, 
            CASE 
                WHEN si.interaction_type = 'knows' THEN 'yo_te_conozco'
                WHEN si.interaction_type = 'fan' THEN 'fans'
                ELSE si.interaction_type
            END,
            COALESCE(si.created_at, NOW())
        FROM public.student_interactions si
        WHERE si.user_uid <> si.student_id
        ON CONFLICT (voter_uid, target_user_id) 
        DO UPDATE SET attitude_type = EXCLUDED.attitude_type;
    END IF;
END $$;

-- B. Migrar residuales de student_crushes -> users_crushes
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_crushes') THEN
        INSERT INTO public.users_crushes (target_user_id, voter_uid, created_at)
        SELECT 
            sc.student_id, 
            sc.user_uid, 
            COALESCE(sc.created_at, NOW())
        FROM public.student_crushes sc
        WHERE sc.student_id <> sc.user_uid
        ON CONFLICT (target_user_id, voter_uid) DO NOTHING;
    END IF;
END $$;

-- C. Migrar residuales de student_votes -> user_reseñas
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_votes') THEN
        INSERT INTO public.user_reseñas (target_user_id, voter_uid, stars, created_at)
        SELECT 
            sv.student_id, 
            sv.user_uid, 
            sv.stars, 
            COALESCE(sv.created_at, NOW())
        FROM public.student_votes sv
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- D. Migrar residuales de student_love_messages -> user_love_messages
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_love_messages') THEN
        INSERT INTO public.user_love_messages (
            target_user_id,
            user_uid,
            author_name,
            author_avatar,
            author_gender,
            message,
            hearts_count,
            created_at
        )
        SELECT 
            slm.student_id, 
            slm.user_uid,
            'Anónimo-' || COALESCE(NULLIF(SUBSTRING(slm.user_uid FROM 1 FOR 8), ''), 'campus'),
            NULL,
            NULL,
            slm.message,
            COALESCE(slm.hearts_count, 0),
            COALESCE(slm.created_at, NOW())
        FROM public.student_love_messages slm
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- PASO 2: ELIMINAR DEFINITIVAMENTE LAS TABLAS OBSOLETAS
-- ------------------------------------------------------------------------------

DROP TABLE IF EXISTS public.student_interactions CASCADE;
DROP TABLE IF EXISTS public.student_love_message_hearts CASCADE;
DROP TABLE IF EXISTS public.student_love_messages CASCADE;
DROP TABLE IF EXISTS public.student_crushes CASCADE;
DROP TABLE IF EXISTS public.student_votes CASCADE;

-- ------------------------------------------------------------------------------
-- PASO 3: RECALCULAR CONTADORES EN USERS_ACTITUD Y PERFILES
-- ------------------------------------------------------------------------------

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
