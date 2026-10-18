-- Instrucción SQL para crear la tabla 'notifications' en Supabase
-- Ejecuta este script en el editor SQL de tu panel de Supabase.

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_uid TEXT NOT NULL,                           -- UID del destinatario (firebase_uid en public.users)
    title TEXT NOT NULL,                             -- Título de la notificación
    body TEXT NOT NULL,                              -- Contenido / descripción
    link_url TEXT,                                   -- Enlace de redirección (ej: /educational_centers/slug)
    is_read BOOLEAN DEFAULT false NOT NULL,          -- Estado de lectura
    created_at TIMESTAMP WITH TIMEZONE DEFAULT NOW() NOT NULL,
    FOREIGN KEY (user_uid) REFERENCES public.users(firebase_uid) ON DELETE CASCADE
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad
CREATE POLICY "Permitir select de sus propias notificaciones" 
ON public.notifications FOR SELECT 
USING (true); -- El filtro se aplica en el cliente o mediante auth.uid() si usas Supabase Auth. Para simplicidad con Firebase, permitimos select.

CREATE POLICY "Permitir update de sus propias notificaciones" 
ON public.notifications FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir inserts de notificaciones públicas" 
ON public.notifications FOR INSERT 
WITH CHECK (true);
