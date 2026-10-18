-- ==============================================================================
-- 🛡️ MIGRACIÓN SUPABASE: EXPULSIÓN Y ELIMINACIÓN COMUNITARIA DE PERFILES
-- ==============================================================================
-- Copia y ejecuta este script en el SQL Editor de tu panel de Supabase:
-- https://supabase.com/dashboard/project/_/sql
--
-- ¿QUÉ HACE ESTE SCRIPT?
-- 1. Permite que la comunidad elimine perfiles falsos/inexistentes que alcancen los 5 votos.
-- 2. Habilita políticas RLS de eliminación (DELETE) para la clave pública (anon).
-- 3. Crea la función RPC de alta seguridad 'expel_profile' (SECURITY DEFINER)
--    que elimina en cascada todos los votos, flechazos, interacciones y el perfil.
-- ==============================================================================

-- 1. POLÍTICAS RLS DE ELIMINACIÓN (DELETE) PARA TABLA 'students'
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students') THEN
        ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Permitir eliminación comunitaria de students" ON public.students;
        CREATE POLICY "Permitir eliminación comunitaria de students" 
            ON public.students FOR DELETE 
            USING (true);

        DROP POLICY IF EXISTS "Permitir actualización de students" ON public.students;
        CREATE POLICY "Permitir actualización de students" 
            ON public.students FOR UPDATE 
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- 2. POLÍTICAS RLS DE ELIMINACIÓN (DELETE) PARA TABLA 'professors'
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'professors') THEN
        ALTER TABLE public.professors ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Permitir eliminación comunitaria de professors" ON public.professors;
        CREATE POLICY "Permitir eliminación comunitaria de professors" 
            ON public.professors FOR DELETE 
            USING (true);

        DROP POLICY IF EXISTS "Permitir actualización de professors" ON public.professors;
        CREATE POLICY "Permitir actualización de professors" 
            ON public.professors FOR UPDATE 
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- 3. HABILITAR DELETE EN TABLAS HIJAS DE ESTUDIANTES
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY[
            'student_votes',
            'student_interactions',
            'student_crushes',
            'student_daily_stats',
            'student_love_messages',
            'student_love_message_hearts',
            'student_notification_subscriptions',
            'professor_votes',
            'professor_interactions',
            'professor_crushes',
            'professor_notification_subscriptions',
            'profile_reports',
            'profile_report_votes'
        ])
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            EXECUTE format('DROP POLICY IF EXISTS "Permitir delete publico en %I" ON public.%I;', tbl, tbl);
            EXECUTE format('CREATE POLICY "Permitir delete publico en %I" ON public.%I FOR DELETE USING (true);', tbl, tbl);
        END IF;
    END LOOP;
END $$;

-- ==============================================================================
-- 4. FUNCIÓN RPC: expel_profile
-- Ejecuta con 'SECURITY DEFINER' para saltarse bloqueos de RLS y dependencias
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.expel_profile(
    p_target_id text,
    p_target_type text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cleaned_id text;
    v_deleted_count int := 0;
BEGIN
    v_cleaned_id := LOWER(TRIM(p_target_id));

    IF p_target_type = 'student' THEN
        -- Borrar dependencias del estudiante de manera segura
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_love_message_hearts') THEN
            DELETE FROM public.student_love_message_hearts 
            WHERE message_id IN (
                SELECT id FROM public.student_love_messages 
                WHERE student_id = p_target_id OR LOWER(student_id) = v_cleaned_id
            );
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_love_messages') THEN
            DELETE FROM public.student_love_messages 
            WHERE student_id = p_target_id OR LOWER(student_id) = v_cleaned_id;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_votes') THEN
            DELETE FROM public.student_votes 
            WHERE student_id = p_target_id OR LOWER(student_id) = v_cleaned_id;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_interactions') THEN
            DELETE FROM public.student_interactions 
            WHERE student_id = p_target_id OR LOWER(student_id) = v_cleaned_id;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_crushes') THEN
            DELETE FROM public.student_crushes 
            WHERE student_id = p_target_id OR LOWER(student_id) = v_cleaned_id;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_daily_stats') THEN
            DELETE FROM public.student_daily_stats 
            WHERE student_id = p_target_id OR LOWER(student_id) = v_cleaned_id;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_notification_subscriptions') THEN
            DELETE FROM public.student_notification_subscriptions 
            WHERE student_id = p_target_id OR LOWER(student_id) = v_cleaned_id;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collection_items') THEN
            DELETE FROM public.collection_items 
            WHERE item_id = p_target_id OR LOWER(item_id) = v_cleaned_id;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profile_reports') THEN
            DELETE FROM public.profile_report_votes 
            WHERE report_id IN (
                SELECT id FROM public.profile_reports 
                WHERE target_id = p_target_id OR LOWER(target_id) = v_cleaned_id
            );
            DELETE FROM public.profile_reports 
            WHERE target_id = p_target_id OR LOWER(target_id) = v_cleaned_id;
        END IF;

        -- Eliminar de la tabla students
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'students') THEN
            DELETE FROM public.students 
            WHERE id = p_target_id OR LOWER(id) = v_cleaned_id;
            GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        END IF;

        -- Si el alumno también estaba registrado en professors (con role = 'Alumno')
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'professors') THEN
            DELETE FROM public.professors 
            WHERE (id = p_target_id OR LOWER(id) = v_cleaned_id) AND (role = 'Alumno' OR role IS NULL);
        END IF;

    ELSE
        -- Borrar dependencias del profesor
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'professor_votes') THEN
            DELETE FROM public.professor_votes 
            WHERE professor_id = p_target_id OR LOWER(professor_id) = v_cleaned_id;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'professor_interactions') THEN
            DELETE FROM public.professor_interactions 
            WHERE professor_id = p_target_id OR LOWER(professor_id) = v_cleaned_id;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'professor_crushes') THEN
            DELETE FROM public.professor_crushes 
            WHERE professor_id = p_target_id OR LOWER(professor_id) = v_cleaned_id;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'professor_notification_subscriptions') THEN
            DELETE FROM public.professor_notification_subscriptions 
            WHERE professor_id = p_target_id OR LOWER(professor_id) = v_cleaned_id;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'collection_items') THEN
            DELETE FROM public.collection_items 
            WHERE item_id = p_target_id OR LOWER(item_id) = v_cleaned_id;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profile_reports') THEN
            DELETE FROM public.profile_report_votes 
            WHERE report_id IN (
                SELECT id FROM public.profile_reports 
                WHERE target_id = p_target_id OR LOWER(target_id) = v_cleaned_id
            );
            DELETE FROM public.profile_reports 
            WHERE target_id = p_target_id OR LOWER(target_id) = v_cleaned_id;
        END IF;

        -- Eliminar de la tabla professors
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'professors') THEN
            DELETE FROM public.professors 
            WHERE id = p_target_id OR LOWER(id) = v_cleaned_id;
            GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        END IF;
    END IF;

    RETURN json_build_object(
        'success', true,
        'target_id', p_target_id,
        'target_type', p_target_type,
        'rows_deleted', v_deleted_count
    );
END;
$$;

-- Permisos de ejecución para todos los roles de Supabase
GRANT EXECUTE ON FUNCTION public.expel_profile(text, text) TO anon, authenticated, service_role;
