-- Instrucción SQL para crear la tabla 'user_fcm_tokens' en Supabase
-- Ejecuta este script en el editor SQL de tu panel de Supabase.

CREATE TABLE IF NOT EXISTS public.user_fcm_tokens (
    user_uid TEXT PRIMARY KEY,                       -- El UID proveniente de Firebase Auth (firebase_uid)
    fcm_token TEXT NOT NULL,                         -- Token FCM del dispositivo
    updated_at TIMESTAMP WITH TIMEZONE DEFAULT NOW() NOT NULL,
    FOREIGN KEY (user_uid) REFERENCES public.users(firebase_uid) ON DELETE CASCADE
);

-- Habilitar Row Level Security (RLS) si deseas proteger la tabla
ALTER TABLE public.user_fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Crear políticas básicas para permitir lecturas y escrituras/upserts
CREATE POLICY "Permitir lecturas de tokens de FCM" 
ON public.user_fcm_tokens FOR SELECT 
USING (true);

CREATE POLICY "Permitir upsert de tokens de FCM para cualquier usuario" 
ON public.user_fcm_tokens FOR ALL 
USING (true) 
WITH CHECK (true);
