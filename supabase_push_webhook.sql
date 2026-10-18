-- ==============================================================================
-- 🚀 SUPABASE DATABASE WEBHOOK / TRIGGER PARA NOTIFICACIONES PUSH (FCM v1)
-- ==============================================================================
-- Este script permite configurar el webhook automático para que cada vez que se 
-- inserte una fila en 'public.notifications', se invoque la Edge Function 'send-push'.

-- OPCIÓN 1 (Recomendada desde el Dashboard de Supabase):
-- 1. Ve a tu Dashboard de Supabase: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
-- 2. Entra en "Database" -> "Webhooks" -> "Create a new webhook"
-- 3. Nombre: "send-push-on-notification"
-- 4. Table: "public.notifications"
-- 5. Events: Marca únicamente "Insert"
-- 6. Type: "Supabase Edge Function" -> Selecciona "send-push"
-- 7. Método HTTP: POST
-- 8. Guarda el webhook. ¡Listo! Cada notificación generará el push automáticamente.

-- ==============================================================================
-- OPCIÓN 2 (Vía SQL con extensión pg_net):
-- ==============================================================================

-- 1. Habilitar extensión pg_net si no está activa
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Crear función disparadora para invocar la Edge Function
CREATE OR REPLACE FUNCTION public.trigger_fcm_push_notification()
RETURNS TRIGGER AS $$
DECLARE
    project_url TEXT := 'https://zamoknovy.supabase.co'; -- Tu URL de proyecto Supabase o tu subdominio
    anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; -- Tu SUPABASE_ANON_KEY o SERVICE_ROLE_KEY
    payload JSONB;
BEGIN
    payload := jsonb_build_object(
        'record', jsonb_build_object(
            'id', NEW.id,
            'user_uid', NEW.user_uid,
            'title', NEW.title,
            'body', NEW.body,
            'link_url', NEW.link_url,
            'created_at', NEW.created_at
        )
    );

    -- Enviar petición HTTP asíncrona a la Edge Function
    PERFORM extensions.http_post(
        url := project_url || '/functions/v1/send-push',
        body := payload::text,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || anon_key
        )
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error al disparar push notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el Trigger en la tabla 'notifications'
DROP TRIGGER IF EXISTS tr_fcm_push_notification ON public.notifications;

CREATE TRIGGER tr_fcm_push_notification
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trigger_fcm_push_notification();

-- ==============================================================================
-- 🔐 SECRETS NECESARIOS EN SUPABASE EDGE FUNCTIONS:
-- ==============================================================================
-- Para que la Edge Function 'send-push' pueda autenticarse con la API de Firebase v1,
-- sube el archivo JSON de tu Service Account de Firebase:
--
-- En la terminal de Supabase CLI:
-- supabase secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account", ...}'
--
-- O en Supabase Dashboard -> Project Settings -> Edge Functions -> Secrets
-- Clave: FIREBASE_SERVICE_ACCOUNT
-- Valor: (Contenido completo de tu archivo JSON descargado de Firebase Console -> Configuración del proyecto -> Cuentas de servicio)
