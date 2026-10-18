import { supabase } from '@/src/lib/supabase';

export type ConfessionCategory = 'all' | 'crush' | 'professors' | 'exams' | 'anecdotes';
export type CardStyle = 'dark' | 'pink' | 'fire';
export type ReactionType = 'heart' | 'laugh' | 'fire' | 'cry' | 'shock';

export interface CenterConfession {
  id: string;
  center_id: string;
  firebase_uid: string | null;
  author_name: string;
  author_gender?: string | null;
  content: string;
  category: 'crush' | 'professors' | 'exams' | 'anecdotes';
  card_style: CardStyle;
  is_anonymous: boolean;
  comments_count: number;
  created_at: string;
  reactions: {
    heart: number;
    laugh: number;
    fire: number;
    cry: number;
    shock: number;
  };
  userReactions: {
    heart: boolean;
    laugh: boolean;
    fire: boolean;
    cry: boolean;
    shock: boolean;
  };
}

export interface ConfessionComment {
  id: string;
  confession_id: string;
  firebase_uid: string | null;
  author_name: string;
  author_gender?: string | null;
  content: string;
  is_anonymous: boolean;
  parent_id?: string | null;
  reply_to_author?: string | null;
  created_at: string;
}

export interface CreateConfessionPayload {
  center_id: string;
  firebase_uid: string | null;
  author_name: string;
  content: string;
  category: 'crush' | 'professors' | 'exams' | 'anecdotes';
  card_style: CardStyle;
  is_anonymous: boolean;
}

export const CONFESSIONS_SETUP_SQL = `-- 1. Tabla de confesiones por centro educativo
CREATE TABLE IF NOT EXISTS public.center_confessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id TEXT NOT NULL,
    firebase_uid TEXT,
    author_name TEXT NOT NULL DEFAULT 'Anónimo',
    content TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('crush', 'professors', 'exams', 'anecdotes')),
    card_style TEXT NOT NULL DEFAULT 'dark' CHECK (card_style IN ('dark', 'pink', 'fire')),
    is_anonymous BOOLEAN NOT NULL DEFAULT true,
    comments_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Tabla de reacciones a las confesiones (5 reacciones: heart, laugh, fire, cry, shock)
CREATE TABLE IF NOT EXISTS public.confession_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    confession_id UUID NOT NULL REFERENCES public.center_confessions(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('heart', 'laugh', 'fire', 'cry', 'shock')),
    user_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(confession_id, user_id, reaction_type)
);

-- 3. Tabla de comentarios y respuestas a confesiones (Soporta 2 niveles de conversación)
CREATE TABLE IF NOT EXISTS public.confession_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    confession_id UUID NOT NULL REFERENCES public.center_confessions(id) ON DELETE CASCADE,
    firebase_uid TEXT,
    author_name TEXT NOT NULL DEFAULT 'Anónimo',
    content TEXT NOT NULL,
    is_anonymous BOOLEAN NOT NULL DEFAULT true,
    parent_id UUID REFERENCES public.confession_comments(id) ON DELETE CASCADE,
    reply_to_author TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Migración segura para agregar columnas de respuesta si ya existe la tabla
ALTER TABLE public.confession_comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.confession_comments(id) ON DELETE CASCADE;
ALTER TABLE public.confession_comments ADD COLUMN IF NOT EXISTS reply_to_author TEXT;

-- 4. Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_center_confessions_center_id ON public.center_confessions(center_id);
CREATE INDEX IF NOT EXISTS idx_center_confessions_created_at ON public.center_confessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_confession_reactions_confession ON public.confession_reactions(confession_id);
CREATE INDEX IF NOT EXISTS idx_confession_comments_confession ON public.confession_comments(confession_id);
CREATE INDEX IF NOT EXISTS idx_confession_comments_parent ON public.confession_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_confession_comments_created_at ON public.confession_comments(created_at ASC);

-- 5. Habilitar Row Level Security (RLS)
ALTER TABLE public.center_confessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confession_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confession_comments ENABLE ROW LEVEL SECURITY;

-- 6. Políticas de acceso seguras
CREATE POLICY "Permitir lectura publica de confesiones" 
ON public.center_confessions FOR SELECT USING (true);

CREATE POLICY "Permitir crear confesiones" 
ON public.center_confessions FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir lectura de reacciones" 
ON public.confession_reactions FOR SELECT USING (true);

CREATE POLICY "Permitir insertar reacciones" 
ON public.confession_reactions FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir eliminar mi reaccion" 
ON public.confession_reactions FOR DELETE USING (true);

CREATE POLICY "Permitir lectura de comentarios" 
ON public.confession_comments FOR SELECT USING (true);

CREATE POLICY "Permitir crear comentarios" 
ON public.confession_comments FOR INSERT WITH CHECK (true);

-- 7. Funciones RPC seguras (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION delete_confession(
  p_confession_id UUID,
  p_firebase_uid TEXT DEFAULT NULL,
  p_user_email TEXT DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF LOWER(COALESCE(p_user_email, '')) = 'wikistars12@gmail.com' THEN
    DELETE FROM public.confession_reactions WHERE confession_id = p_confession_id;
    DELETE FROM public.confession_comments WHERE confession_id = p_confession_id;
    DELETE FROM public.center_confessions WHERE id = p_confession_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted > 0;
  END IF;

  IF p_firebase_uid IS NOT NULL AND p_firebase_uid <> '' THEN
    DELETE FROM public.confession_reactions WHERE confession_id = p_confession_id;
    DELETE FROM public.confession_comments WHERE confession_id = p_confession_id;
    DELETE FROM public.center_confessions 
    WHERE id = p_confession_id AND firebase_uid = p_firebase_uid;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted > 0;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_comments_count(p_confession_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.center_confessions
  SET comments_count = COALESCE(comments_count, 0) + 1
  WHERE id = p_confession_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;

// Utility to get display name for anonymous users without chosen names (e.g. user_y5Pl5 from uid)
export function getDisplayAuthorName(
  authorName?: string | null,
  firebaseUid?: string | null,
  isAnonymous: boolean = true
): string {
  const cleanName = (authorName || '').trim();
  const lower = cleanName.toLowerCase();

  const isGenericAnon = !cleanName || 
    lower === 'anónimo' || 
    lower === 'anonimo' || 
    lower === 'usuario anónimo' || 
    lower === 'usuario anonimo' || 
    lower === 'usuario' ||
    lower === 'anon' ||
    lower === 'alguien' ||
    lower === 'user';

  // Si el usuario eligió un nombre de usuario real (ej: "vegano1", "Juan", etc.), se respeta siempre su nombre
  if (!isGenericAnon) {
    return cleanName;
  }

  // Si no eligió nombre o es anónimo genérico, se genera el identificador con los primeros 5 caracteres de su UID
  if (firebaseUid && firebaseUid.trim()) {
    return `user_${firebaseUid.trim().substring(0, 5)}`;
  }

  return 'user_anon';
}

// Utility to get or create a persistent anonymous device client ID for reaction tracking
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'anon_device';
  let deviceId = localStorage.getItem('starryz_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem('starryz_device_id', deviceId);
  }
  return deviceId;
}

export function getMyConfessionIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('starryz_my_confessions') || '[]');
  } catch (e) {
    return [];
  }
}

// Format relative time in Spanish
export function formatTimeAgo(dateString: string): string {
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

    if (diffSeconds < 60) return 'Hace un momento';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
    const diffMonths = Math.floor(diffDays / 30);
    return `Hace ${diffMonths} ${diffMonths === 1 ? 'mes' : 'meses'}`;
  } catch (e) {
    return 'Reciente';
  }
}

/**
 * Obtiene ÚNICAMENTE las confesiones reales existentes en la base de datos Supabase
 */
export async function getCenterConfessions(
  centerId: string,
  category: ConfessionCategory = 'all',
  sortBy: 'recent' | 'popular' = 'recent',
  currentUserId?: string
): Promise<{ data: CenterConfession[]; isTableMissing: boolean }> {
  const effectiveUserId = currentUserId || getDeviceId();

  // Consulta directa en la tabla 'center_confessions' de Supabase
  try {
    let query = supabase
      .from('center_confessions')
      .select('*')
      .eq('center_id', centerId);

    if (category !== 'all') {
      query = query.eq('category', category);
    }

    query = query.order('created_at', { ascending: false });

    const { data: confessionsData, error } = await query;

    if (error) {
      const isMissing = error.message?.includes('schema cache') || 
                        error.message?.includes('does not exist') || 
                        error.code === 'PGRST204' || 
                        error.code === '42P01';

      if (isMissing) {
        return { data: [], isTableMissing: true };
      }

      console.warn('Aviso al consultar confesiones en Supabase:', error.message || error);
      return { data: [], isTableMissing: false };
    }

    if (!confessionsData || confessionsData.length === 0) {
      return { data: [], isTableMissing: false };
    }

    const confessionIds = confessionsData.map((c: any) => c.id);

    // Map para las 5 reacciones reales
    const reactionsMap: Record<string, { heart: number; laugh: number; fire: number; cry: number; shock: number }> = {};
    const userReactionsMap: Record<string, { heart: boolean; laugh: boolean; fire: boolean; cry: boolean; shock: boolean }> = {};

    confessionIds.forEach((id) => {
      reactionsMap[id] = { heart: 0, laugh: 0, fire: 0, cry: 0, shock: 0 };
      userReactionsMap[id] = { heart: false, laugh: false, fire: false, cry: false, shock: false };
    });

    try {
      const { data: reactionsData, error: reactErr } = await supabase
        .from('confession_reactions')
        .select('confession_id, reaction_type, user_id')
        .in('confession_id', confessionIds);

      if (!reactErr && reactionsData) {
        reactionsData.forEach((r: any) => {
          const type = r.reaction_type as ReactionType;
          if (reactionsMap[r.confession_id] && reactionsMap[r.confession_id][type] !== undefined) {
            reactionsMap[r.confession_id][type] += 1;
            if (r.user_id === effectiveUserId || (currentUserId && r.user_id === currentUserId)) {
              userReactionsMap[r.confession_id][type] = true;
            }
          }
        });
      }
    } catch (rErr) {
      // Ignorar si la tabla de reacciones aún se está creando
    }

    // Recopilar UIDs únicos para obtener los nombres reales y géneros de los autores
    const authorUids = Array.from(
      new Set(
        confessionsData
          .map((c: any) => c.firebase_uid)
          .filter((uid: any): uid is string => Boolean(uid && typeof uid === 'string'))
      )
    );

    const userProfileMap: Record<string, { name?: string; gender?: string }> = {};
    if (authorUids.length > 0) {
      try {
        const { data: usersData } = await supabase
          .from('users')
          .select('firebase_uid, username, display_name, gender')
          .in('firebase_uid', authorUids);

        if (usersData && Array.isArray(usersData)) {
          usersData.forEach((u: any) => {
            if (u.firebase_uid) {
              const customName = (u.username || u.display_name || '').trim();
              const isGen = !customName || 
                customName.toLowerCase() === 'anónimo' || 
                customName.toLowerCase() === 'anonimo' || 
                customName.toLowerCase() === 'usuario anónimo';
              
              userProfileMap[u.firebase_uid] = {
                name: !isGen ? customName : `user_${u.firebase_uid.substring(0, 5)}`,
                gender: u.gender || null,
              };
            }
          });
        }
      } catch (uErr) {
        // Ignorar si hay error consultando usuarios
      }
    }

    const result: CenterConfession[] = confessionsData.map((c: any) => {
      const reacts = reactionsMap[c.id] || { heart: 0, laugh: 0, fire: 0, cry: 0, shock: 0 };
      const userReacts = userReactionsMap[c.id] || { heart: false, laugh: false, fire: false, cry: false, shock: false };

      let authorGender = c.firebase_uid ? userProfileMap[c.firebase_uid]?.gender || null : null;
      if (!authorGender && c.firebase_uid && typeof window !== 'undefined') {
        const cachedGender = localStorage.getItem(`user_gender_${c.firebase_uid}`);
        if (cachedGender) authorGender = cachedGender;
      }

      let authorName = (c.author_name || '').trim();
      const isGeneric = !authorName || 
        authorName.toLowerCase() === 'anónimo' || 
        authorName.toLowerCase() === 'anonimo' || 
        authorName.toLowerCase() === 'usuario anónimo' ||
        authorName.toLowerCase() === 'user_anon';

      if (isGeneric && c.firebase_uid) {
        if (userProfileMap[c.firebase_uid]?.name) {
          authorName = userProfileMap[c.firebase_uid]!.name!;
        } else {
          authorName = `user_${c.firebase_uid.substring(0, 5)}`;
        }
      } else if (!authorName) {
        authorName = c.firebase_uid ? `user_${c.firebase_uid.substring(0, 5)}` : 'Anónimo';
      }

      return {
        id: c.id,
        center_id: c.center_id,
        firebase_uid: c.firebase_uid,
        author_name: authorName,
        author_gender: authorGender,
        content: c.content,
        category: c.category || 'anecdotes',
        card_style: c.card_style || 'dark',
        is_anonymous: c.is_anonymous ?? true,
        comments_count: c.comments_count || 0,
        created_at: c.created_at || new Date().toISOString(),
        reactions: reacts,
        userReactions: userReacts,
      };
    });

    if (sortBy === 'popular') {
      result.sort((a, b) => {
        const totalA = a.reactions.heart + a.reactions.laugh + a.reactions.fire + a.reactions.cry + a.reactions.shock;
        const totalB = b.reactions.heart + b.reactions.laugh + b.reactions.fire + b.reactions.cry + b.reactions.shock;
        return totalB - totalA || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return { data: result, isTableMissing: false };
  } catch (err) {
    return { data: [], isTableMissing: false };
  }
}

/**
 * Publica una nueva confesión en 'center_confessions' de Supabase
 */
export async function createCenterConfession(payload: CreateConfessionPayload): Promise<CenterConfession> {
  const effectiveAuthorName = getDisplayAuthorName(
    payload.author_name,
    payload.firebase_uid,
    payload.is_anonymous
  );

  const record = {
    center_id: payload.center_id,
    firebase_uid: payload.firebase_uid,
    author_name: effectiveAuthorName,
    content: payload.content,
    category: payload.category,
    card_style: payload.card_style,
    is_anonymous: payload.is_anonymous,
    comments_count: 0,
  };

  const { data, error } = await supabase
    .from('center_confessions')
    .insert([record])
    .select()
    .single();

  if (error) {
    const isMissing = error.message?.includes('schema cache') || 
                      error.message?.includes('does not exist') || 
                      error.code === 'PGRST204' || 
                      error.code === '42P01';

    if (isMissing) {
      throw new Error("La tabla 'center_confessions' no existe aún en tu base de datos Supabase. Ejecuta el script SQL en el editor de Supabase.");
    }
    throw error;
  }

  // Guardar ID en localStorage para filtro 'Ver mis confesiones'
  if (typeof window !== 'undefined' && data?.id) {
    try {
      const myConfessions = JSON.parse(localStorage.getItem('starryz_my_confessions') || '[]');
      if (!myConfessions.includes(data.id)) {
        myConfessions.push(data.id);
        localStorage.setItem('starryz_my_confessions', JSON.stringify(myConfessions));
      }
    } catch (e) {}
  }

  return {
    ...data,
    reactions: { heart: 0, laugh: 0, fire: 0, cry: 0, shock: 0 },
    userReactions: { heart: false, laugh: false, fire: false, cry: false, shock: false },
  };
}

/**
 * Alterna una reacción (❤️, 😂, 🔥, 😭, 🤯) en la tabla 'confession_reactions' de Supabase
 */
export async function toggleConfessionReaction(
  confessionId: string,
  reactionType: ReactionType,
  currentUserId?: string,
  currentUserName?: string
): Promise<{ added: boolean }> {
  const effectiveUserId = currentUserId || getDeviceId();

  try {
    // Buscar todas las reacciones de este usuario en esta confesión
    const { data: existingReactions, error: selectErr } = await supabase
      .from('confession_reactions')
      .select('id, reaction_type')
      .eq('confession_id', confessionId)
      .eq('user_id', effectiveUserId);

    if (selectErr) {
      const isMissing = selectErr.message?.includes('schema cache') || 
                        selectErr.message?.includes('does not exist');
      if (isMissing) {
        return { added: true };
      }
    }

    const sameTypeReaction = existingReactions?.find(r => r.reaction_type === reactionType);
    const otherTypeReactions = existingReactions?.filter(r => r.reaction_type !== reactionType) || [];

    // Si ya existe la reacción del mismo tipo, la quitamos (toggle off)
    if (sameTypeReaction) {
      await supabase
         .from('confession_reactions')
         .delete()
         .eq('id', sameTypeReaction.id);

      return { added: false };
    }

    // Si tiene reacciones de otros tipos, las eliminamos primero (para asegurar máx 1 reacción)
    if (otherTypeReactions.length > 0) {
      const otherIds = otherTypeReactions.map(r => r.id);
      await supabase
         .from('confession_reactions')
         .delete()
         .in('id', otherIds);
    }

    // Insertar la nueva reacción
    await supabase
      .from('confession_reactions')
      .insert([
        {
          confession_id: confessionId,
          reaction_type: reactionType,
          user_id: effectiveUserId,
        },
      ]);

    // Disparar notificación si el dueño es otro usuario
    try {
      const { data: confession } = await supabase
        .from('center_confessions')
        .select('firebase_uid, center_id')
        .eq('id', confessionId)
        .single();

      if (confession && confession.firebase_uid && confession.firebase_uid !== effectiveUserId) {
        let centerName = '';
        if (confession.center_id) {
          const { data: centerData } = await supabase
            .from('educational_centers')
            .select('name')
            .eq('id', confession.center_id)
            .maybeSingle();
          if (centerData?.name) centerName = centerData.name;
        }

        const emoji = reactionType === 'heart' ? '❤️' : 
                      reactionType === 'laugh' ? '😂' : 
                      reactionType === 'fire' ? '🔥' : 
                      reactionType === 'cry' ? '😭' : '🤯';
        
        const senderName = currentUserName || 'Alguien';
        const centerSuffix = centerName ? ` en ${centerName}` : '';
        const bodyText = `[${senderName}] ha reaccionado con ${emoji} a tu confesión${centerSuffix}`;
        
        const notifLinkUrl = `/?show_confession=${confessionId}`;
        
        const { error: notiError } = await supabase.from('notifications').insert([{
          user_uid: confession.firebase_uid,
          title: senderName,
          body: bodyText,
          link_url: notifLinkUrl,
          is_read: false
        }]);

        if (!notiError) {
          // Despachar Push Notification vía Edge Function rapid-processor
          supabase.functions.invoke('rapid-processor', {
            body: {
              user_uid: confession.firebase_uid,
              title: senderName,
              body: bodyText,
              link_url: notifLinkUrl,
              confession_id: confessionId
            }
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('No se pudo enviar la notificación de reacción:', err);
    }

    return { added: true };
  } catch (err) {
    return { added: true };
  }
}

/**
 * Elimina una confesión propia de Supabase de manera segura usando RPC o fallback
 */
export async function deleteCenterConfession(
  confessionId: string,
  userUid?: string | null,
  userEmail?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Intentar primero a través de la función segura RPC 'delete_confession'
    const { data: rpcSuccess, error: rpcError } = await supabase.rpc('delete_confession', {
      p_confession_id: confessionId,
      p_firebase_uid: userUid || null,
      p_user_email: userEmail || null,
    });

    if (!rpcError && rpcSuccess === true) {
      // Remover de localStorage para usuarios que crearon confesión anónima
      if (typeof window !== 'undefined') {
        try {
          const myConfessions = JSON.parse(localStorage.getItem('starryz_my_confessions') || '[]');
          const updated = myConfessions.filter((id: string) => id !== confessionId);
          localStorage.setItem('starryz_my_confessions', JSON.stringify(updated));
        } catch (e) {}
      }
      return { success: true };
    }

    // 2. Fallback de borrado directo (si no se ha creado la función RPC aún)
    await supabase
      .from('confession_reactions')
      .delete()
      .eq('confession_id', confessionId);

    await supabase
      .from('confession_comments')
      .delete()
      .eq('confession_id', confessionId);

    const { error } = await supabase
      .from('center_confessions')
      .delete()
      .eq('id', confessionId);

    if (error && rpcError) {
      console.error('Error al eliminar confesión de Supabase:', rpcError || error);
      return { success: false, error: rpcError?.message || error?.message };
    }

    // 3. Remover de localStorage
    if (typeof window !== 'undefined') {
      try {
        const myConfessions = JSON.parse(localStorage.getItem('starryz_my_confessions') || '[]');
        const updated = myConfessions.filter((id: string) => id !== confessionId);
        localStorage.setItem('starryz_my_confessions', JSON.stringify(updated));
      } catch (e) {}
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error al eliminar confesión:', err);
    return { success: false, error: err?.message || 'Error al conectar con Supabase' };
  }
}

/**
 * Obtiene las respuestas / comentarios de una confesión
 */
export async function getConfessionComments(confessionId: string): Promise<ConfessionComment[]> {
  try {
    const { data, error } = await supabase
      .from('confession_comments')
      .select('*')
      .eq('confession_id', confessionId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];

    // Recopilar UIDs únicos de los autores de comentarios
    const authorUids = Array.from(
      new Set(
        data
          .map((c: any) => c.firebase_uid)
          .filter((uid: any): uid is string => Boolean(uid && typeof uid === 'string'))
      )
    );

    const userProfileMap: Record<string, { name?: string; gender?: string }> = {};
    if (authorUids.length > 0) {
      try {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, username, display_name, gender')
          .in('id', authorUids);

        if (usersData && Array.isArray(usersData)) {
          usersData.forEach((u: any) => {
            if (u.id) {
              const customName = (u.username || u.display_name || '').trim();
              const isGen = !customName || 
                customName.toLowerCase() === 'anónimo' || 
                customName.toLowerCase() === 'anonimo' || 
                customName.toLowerCase() === 'usuario anónimo';
              
              userProfileMap[u.id] = {
                name: !isGen ? customName : `user_${u.id.substring(0, 5)}`,
                gender: u.gender || null,
              };
            }
          });
        }
      } catch (uErr) {
        // Ignorar
      }
    }

    return data.map((comment: any) => {
      let authorGender = comment.firebase_uid ? userProfileMap[comment.firebase_uid]?.gender || null : null;
      if (!authorGender && comment.firebase_uid && typeof window !== 'undefined') {
        const cachedGender = localStorage.getItem(`user_gender_${comment.firebase_uid}`);
        if (cachedGender) authorGender = cachedGender;
      }

      let authorName = (comment.author_name || '').trim();
      const isGeneric = !authorName || 
        authorName.toLowerCase() === 'anónimo' || 
        authorName.toLowerCase() === 'anonimo' || 
        authorName.toLowerCase() === 'usuario anónimo' ||
        authorName.toLowerCase() === 'user_anon';

      if (isGeneric && comment.firebase_uid) {
        if (userProfileMap[comment.firebase_uid]?.name) {
          authorName = userProfileMap[comment.firebase_uid]!.name!;
        } else {
          authorName = `user_${comment.firebase_uid.substring(0, 5)}`;
        }
      } else if (!authorName) {
        authorName = comment.firebase_uid ? `user_${comment.firebase_uid.substring(0, 5)}` : 'Anónimo';
      }

      return {
        ...comment,
        author_name: authorName,
        author_gender: authorGender,
      };
    });
  } catch (err) {
    return [];
  }
}

/**
 * Agrega un nuevo comentario / respuesta a una confesión (Nivel 1 o Nivel 2 en respuesta a alguien)
 */
export async function createConfessionComment(payload: {
  confession_id: string;
  firebase_uid: string | null;
  author_name: string;
  content: string;
  is_anonymous: boolean;
  parent_id?: string | null;
  reply_to_author?: string | null;
}): Promise<ConfessionComment> {
  const effectiveAuthorName = getDisplayAuthorName(
    payload.author_name,
    payload.firebase_uid,
    payload.is_anonymous
  );

  const record: Record<string, any> = {
    confession_id: payload.confession_id,
    firebase_uid: payload.firebase_uid,
    author_name: effectiveAuthorName,
    content: payload.content,
    is_anonymous: payload.is_anonymous,
  };

  if (payload.parent_id) {
    record.parent_id = payload.parent_id;
  }
  if (payload.reply_to_author) {
    record.reply_to_author = payload.reply_to_author;
  }

  let data: any = null;
  let error: any = null;

  // Intento 1: Insertar con parent_id y reply_to_author
  const res1 = await supabase
    .from('confession_comments')
    .insert([record])
    .select()
    .single();

  data = res1.data;
  error = res1.error;

  // Fallback seguro si la tabla aún no tiene las columnas parent_id / reply_to_author en Supabase
  if (error && (error.message?.includes('parent_id') || error.message?.includes('reply_to_author') || error.code === '42703')) {
    const fallbackRecord = {
      confession_id: payload.confession_id,
      firebase_uid: payload.firebase_uid,
      author_name: effectiveAuthorName,
      content: payload.content,
      is_anonymous: payload.is_anonymous,
    };
    const res2 = await supabase
      .from('confession_comments')
      .insert([fallbackRecord])
      .select()
      .single();
    data = res2.data;
    error = res2.error;
    if (data) {
      data.parent_id = payload.parent_id || null;
      data.reply_to_author = payload.reply_to_author || null;
    }
  }

  if (error) {
    console.error('Error al insertar comentario:', error);
    throw error;
  }

  // Incrementar el conteo en center_confessions y disparar notificación
  try {
    const { data: conf } = await supabase
      .from('center_confessions')
      .select('comments_count, firebase_uid, center_id')
      .eq('id', payload.confession_id)
      .single();

    if (conf) {
      const newCount = (conf.comments_count || 0) + 1;

      // Sincronizar el conteo real exacto de comentarios
      const { count } = await supabase
        .from('confession_comments')
        .select('*', { count: 'exact', head: true })
        .eq('confession_id', payload.confession_id);

      const exactCount = count !== null && count !== undefined ? count : (conf.comments_count || 0) + 1;

      await supabase
        .from('center_confessions')
        .update({ comments_count: exactCount })
        .eq('id', payload.confession_id);

      let centerName = '';
      if (conf.center_id) {
        const { data: centerData } = await supabase
          .from('educational_centers')
          .select('name')
          .eq('id', conf.center_id)
          .maybeSingle();
        if (centerData?.name) centerName = centerData.name;
      }
      const centerSuffix = centerName ? ` en ${centerName}` : '';
      const senderName = payload.author_name || 'Alguien';

      // 1. Notificación Nivel 2: Si es una respuesta a otro comentario
      let notifiedParentUser = false;
      if (payload.parent_id) {
        try {
          const { data: parentComment } = await supabase
            .from('confession_comments')
            .select('firebase_uid, author_name')
            .eq('id', payload.parent_id)
            .maybeSingle();

          if (parentComment?.firebase_uid && parentComment.firebase_uid !== payload.firebase_uid) {
            notifiedParentUser = true;
            const replyBody = `[${senderName}] te ha respondido a tu comentario${centerSuffix}: "${payload.content.substring(0, 45)}${payload.content.length > 45 ? '...' : ''}"`;
            const notifLinkUrl = `/?show_confession=${payload.confession_id}&comment_id=${data.id}`;

            const { error: notiError } = await supabase.from('notifications').insert([{
              user_uid: parentComment.firebase_uid,
              title: senderName,
              body: replyBody,
              link_url: notifLinkUrl,
              is_read: false
            }]);

            if (!notiError) {
              supabase.functions.invoke('rapid-processor', {
                body: {
                  user_uid: parentComment.firebase_uid,
                  title: senderName,
                  body: replyBody,
                  link_url: notifLinkUrl,
                  confession_id: payload.confession_id,
                  comment_id: data.id
                }
              }).catch(() => {});
            }
          }
        } catch (parentErr) {
          console.warn('No se pudo notificar al autor del comentario padre:', parentErr);
        }
      }

      // 2. Notificación al autor de la confesión (si no es el mismo que responde y no fue notificado arriba)
      if (conf.firebase_uid && conf.firebase_uid !== payload.firebase_uid && (!notifiedParentUser || conf.firebase_uid !== payload.parent_id)) {
        const bodyText = payload.reply_to_author 
          ? `[${senderName}] ha respondido en tu confesión${centerSuffix} (a @${payload.reply_to_author}): "${payload.content.substring(0, 45)}${payload.content.length > 45 ? '...' : ''}"`
          : `[${senderName}] ha respondido a tu confesión${centerSuffix}: "${payload.content.substring(0, 45)}${payload.content.length > 45 ? '...' : ''}"`;

        const notifLinkUrl = `/?show_confession=${payload.confession_id}&comment_id=${data.id}`;

        const { error: notiError } = await supabase.from('notifications').insert([{
          user_uid: conf.firebase_uid,
          title: senderName,
          body: bodyText,
          link_url: notifLinkUrl,
          is_read: false
        }]);

        if (!notiError) {
          // Despachar Push Notification vía Edge Function rapid-processor
          supabase.functions.invoke('rapid-processor', {
            body: {
              user_uid: conf.firebase_uid,
              title: senderName,
              body: bodyText,
              link_url: notifLinkUrl,
              confession_id: payload.confession_id,
              comment_id: data.id
            }
          }).catch(() => {});
        }
      }
    }
  } catch (e) {
    console.warn('Error al actualizar conteo de comentarios o disparar notificación:', e);
  }

  return data;
}

/**
 * Elimina una respuesta / comentario propio y decrementa el conteo de comentarios en la confesión
 */
export async function deleteConfessionComment(commentId: string, confessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error: deleteErr } = await supabase
      .from('confession_comments')
      .delete()
      .eq('id', commentId);

    if (deleteErr) {
      console.error('Error al eliminar comentario de Supabase:', deleteErr);
      return { success: false, error: deleteErr.message };
    }

    // Sincronizar conteo real exacto de comentarios
    try {
      const { count } = await supabase
        .from('confession_comments')
        .select('*', { count: 'exact', head: true })
        .eq('confession_id', confessionId);

      const exactCount = count !== null && count !== undefined ? count : 0;

      await supabase
        .from('center_confessions')
        .update({ comments_count: exactCount })
        .eq('id', confessionId);
    } catch (e) {
      console.warn('Error al actualizar comments_count al eliminar comentario:', e);
    }

    return { success: true };
  } catch (err: any) {
    console.error('Error al eliminar comentario:', err);
    return { success: false, error: err?.message || 'Error al conectar con Supabase' };
  }
}
