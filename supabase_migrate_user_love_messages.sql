-- ============================================================================
-- SCRIPT DE MIGRACIÓN PARA SUPABASE SQL EDITOR:
-- 1. TABLA 'user_love_messages' (Para confesiones y mensajes de amor anónimos)
-- 2. TABLA 'user_love_reactions' (Para corazones y reacciones a los mensajes)
-- 3. ALIAS / RETROCOMPATIBILIDAD CON 'users_love_messages'
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PARTE 1: CREAR TABLA 'user_love_messages'
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_love_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id TEXT NOT NULL,       -- ID del estudiante o usuario que recibe el mensaje
  student_id TEXT,                    -- Compatibilidad retroactiva
  user_uid TEXT NOT NULL,             -- UID del autor (emisor del mensaje)
  author_name TEXT DEFAULT 'Anónimo', -- Nombre anónimo ("Anónimo-XXXXXXXX")
  author_avatar TEXT DEFAULT NULL,    -- 100% Anónimo: NUNCA foto de perfil
  author_gender TEXT DEFAULT NULL,    -- Género seleccionado ('male' / 'female' / etc.)
  message TEXT NOT NULL,              -- Texto de la declaración (máx 500 car.)
  hearts_count INTEGER DEFAULT 0,     -- Cantidad de corazones acumulados
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS en 'user_love_messages'
ALTER TABLE public.user_love_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de user_love_messages" ON public.user_love_messages;
CREATE POLICY "Lectura pública de user_love_messages"
  ON public.user_love_messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Inserción pública de user_love_messages" ON public.user_love_messages;
CREATE POLICY "Inserción pública de user_love_messages"
  ON public.user_love_messages FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Actualización de user_love_messages" ON public.user_love_messages;
CREATE POLICY "Actualización de user_love_messages"
  ON public.user_love_messages FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Eliminación de user_love_messages" ON public.user_love_messages;
CREATE POLICY "Eliminación de user_love_messages"
  ON public.user_love_messages FOR DELETE
  USING (true);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_user_love_messages_target ON public.user_love_messages(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_love_messages_student ON public.user_love_messages(student_id);
CREATE INDEX IF NOT EXISTS idx_user_love_messages_user ON public.user_love_messages(user_uid);
CREATE INDEX IF NOT EXISTS idx_user_love_messages_created ON public.user_love_messages(created_at DESC);


-- ----------------------------------------------------------------------------
-- PARTE 2: CREAR TABLA 'user_love_reactions' (Corazones a mensajes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_love_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL,           -- ID del mensaje de amor
  user_uid TEXT NOT NULL,             -- UID del usuario que deja corazón
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_love_reaction UNIQUE (message_id, user_uid)
);

-- Habilitar RLS en 'user_love_reactions'
ALTER TABLE public.user_love_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de user_love_reactions" ON public.user_love_reactions;
CREATE POLICY "Lectura pública de user_love_reactions"
  ON public.user_love_reactions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Inserción pública de user_love_reactions" ON public.user_love_reactions;
CREATE POLICY "Inserción pública de user_love_reactions"
  ON public.user_love_reactions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Eliminación de user_love_reactions" ON public.user_love_reactions;
CREATE POLICY "Eliminación de user_love_reactions"
  ON public.user_love_reactions FOR DELETE
  USING (true);

-- Índices para búsquedas inmediatas
CREATE INDEX IF NOT EXISTS idx_user_love_reactions_msg ON public.user_love_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_user_love_reactions_user ON public.user_love_reactions(user_uid);
CREATE INDEX IF NOT EXISTS idx_user_love_reactions_msg_user ON public.user_love_reactions(message_id, user_uid);


-- ----------------------------------------------------------------------------
-- PARTE 3: TABLAS PLURALES 'users_love_messages' y 'users_love_message_hearts' (SIN ERRORES)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users_love_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id TEXT NOT NULL,
  student_id TEXT,
  user_uid TEXT NOT NULL,
  author_name TEXT DEFAULT 'Anónimo',
  author_avatar TEXT DEFAULT NULL,
  author_gender TEXT DEFAULT NULL,
  message TEXT NOT NULL,
  hearts_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users_love_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de users_love_messages" ON public.users_love_messages;
CREATE POLICY "Lectura pública de users_love_messages"
  ON public.users_love_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Inserción pública de users_love_messages" ON public.users_love_messages;
CREATE POLICY "Inserción pública de users_love_messages"
  ON public.users_love_messages FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Actualización de users_love_messages" ON public.users_love_messages;
CREATE POLICY "Actualización de users_love_messages"
  ON public.users_love_messages FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Eliminación de users_love_messages" ON public.users_love_messages;
CREATE POLICY "Eliminación de users_love_messages"
  ON public.users_love_messages FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS public.users_love_message_hearts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_uid TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users_love_message_hearts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública de users_love_message_hearts" ON public.users_love_message_hearts;
CREATE POLICY "Lectura pública de users_love_message_hearts"
  ON public.users_love_message_hearts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Inserción de users_love_message_hearts" ON public.users_love_message_hearts;
CREATE POLICY "Inserción de users_love_message_hearts"
  ON public.users_love_message_hearts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Eliminación de users_love_message_hearts" ON public.users_love_message_hearts;
CREATE POLICY "Eliminación de users_love_message_hearts"
  ON public.users_love_message_hearts FOR DELETE USING (true);


-- ----------------------------------------------------------------------------
-- PARTE 4: MIGRACIÓN DE DATOS HISTÓRICOS DESDE 'student_love_messages'
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Migrar mensajes de amor antiguos asegurando anonimato estricto
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_love_messages') THEN
    INSERT INTO public.user_love_messages (
      target_user_id,
      student_id,
      user_uid,
      author_name,
      author_avatar,
      message,
      hearts_count,
      created_at
    )
    SELECT 
      slm.student_id, 
      slm.student_id, 
      slm.user_uid,
      -- Anonimato: "Anónimo-" + primeras 8 letras/números de su ID
      'Anónimo-' || COALESCE(SUBSTRING(slm.user_uid FROM 1 FOR 8), 'campus'),
      NULL, -- Nunca foto de perfil
      slm.message,
      COALESCE(slm.hearts_count, 0),
      COALESCE(slm.created_at, NOW())
    FROM public.student_love_messages slm;

    -- También copiar a users_love_messages para sincronía total
    INSERT INTO public.users_love_messages (
      target_user_id,
      student_id,
      user_uid,
      author_name,
      author_avatar,
      message,
      hearts_count,
      created_at
    )
    SELECT 
      slm.student_id, 
      slm.student_id, 
      slm.user_uid,
      'Anónimo-' || COALESCE(SUBSTRING(slm.user_uid FROM 1 FOR 8), 'campus'),
      NULL,
      slm.message,
      COALESCE(slm.hearts_count, 0),
      COALESCE(slm.created_at, NOW())
    FROM public.student_love_messages slm;
  END IF;

  -- Migrar reacciones y corazones históricos
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_love_message_hearts') THEN
    INSERT INTO public.user_love_reactions (message_id, user_uid, created_at)
    SELECT 
      slh.message_id::text, 
      slh.user_uid,
      COALESCE(slh.created_at, NOW())
    FROM public.student_love_message_hearts slh
    ON CONFLICT (message_id, user_uid) DO NOTHING;

    INSERT INTO public.users_love_message_hearts (message_id, user_uid, created_at)
    SELECT 
      slh.message_id::text, 
      slh.user_uid,
      COALESCE(slh.created_at, NOW())
    FROM public.student_love_message_hearts slh;
  END IF;

  -- Asignar el género de los autores registrados en la tabla 'users' a los mensajes migrados
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
    UPDATE public.user_love_messages ulm
    SET author_gender = u.gender
    FROM public.users u
    WHERE u.id::text = ulm.user_uid AND u.gender IS NOT NULL;

    UPDATE public.users_love_messages ulm
    SET author_gender = u.gender
    FROM public.users u
    WHERE u.id::text = ulm.user_uid AND u.gender IS NOT NULL;
  END IF;

END $$;
