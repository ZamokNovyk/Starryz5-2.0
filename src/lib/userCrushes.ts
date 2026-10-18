import { supabase } from './supabase';

export interface UserCrushItem {
  id: string;
  voter_uid: string;
  target_user_id: string;
  created_at: string;
}

/**
 * Actualiza la columna acumulada 'crushes_count' directamente en la tabla 'users'
 */
async function syncUserCrushesCount(targetUserId: string, count: number) {
  if (!targetUserId) return;
  try {
    await supabase
      .from('users')
      .update({ crushes_count: count })
      .eq('id', targetUserId);
  } catch (e) {
    console.warn('Aviso al sincronizar crushes_count en tabla users:', e);
  }
}

/**
 * Obtiene el total de crushes que ha recibido un usuario.
 * Lee primero de la columna 'crushes_count' en 'users' y, si fuera nula, calcula desde 'users_crushes'.
 */
export async function getUserCrushesCount(targetUserId: string, alternateIds?: string[]): Promise<number> {
  if (!targetUserId) return 0;

  try {
    const candidateIds = Array.from(new Set([targetUserId, ...(alternateIds || [])].filter(Boolean)));

    // 1. Contar filas reales en 'users_crushes' como fuente de verdad
    const { data, error } = await supabase
      .from('users_crushes')
      .select('id')
      .in('target_user_id', candidateIds);

    let count = 0;
    if (!error && Array.isArray(data)) {
      count = data.length;
    }

    // 2. Fallback a columna cacheada en 'users'
    const uuidId = candidateIds.find(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    if (uuidId) {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('crushes_count')
          .eq('id', uuidId)
          .maybeSingle();

        if (userData && typeof userData.crushes_count === 'number') {
          count = Math.max(count, userData.crushes_count);
        }
      } catch (e) {}
    }

    return count;
  } catch (err) {
    console.warn('Aviso al obtener conteo de crushes:', err);
    return 0;
  }
}

/**
 * Consulta si el votante actual ha dado crush a un usuario específico
 */
export async function hasUserCrushed(
  targetUserId: string, 
  voterUid: string,
  alternateIds?: string[]
): Promise<boolean> {
  if (!targetUserId || !voterUid || targetUserId === voterUid) return false;

  try {
    const candidateIds = Array.from(new Set([targetUserId, ...(alternateIds || [])].filter(Boolean)));
    const { data } = await supabase
      .from('users_crushes')
      .select('id')
      .in('target_user_id', candidateIds)
      .eq('voter_uid', voterUid)
      .limit(1)
      .maybeSingle();

    return !!data;
  } catch (err) {
    console.warn('Aviso al verificar estado de crush:', err);
    return false;
  }
}

/**
 * Alterna (agrega o remueve) un crush en 'users_crushes':
 * - Bloqueado si intenta autovotarse.
 * - Si ya dio crush -> Elimina la fila de 'users_crushes' (-1)
 * - Si no ha dado crush -> Inserta la fila en 'users_crushes' (+1)
 */
export async function toggleUserCrush(
  targetUserId: string,
  voterUid: string
): Promise<{
  hasCrushed: boolean;
  newCount: number;
  error?: string;
}> {
  // BLOQUEO: No se puede marcar a uno mismo como crush
  if (targetUserId === voterUid) {
    const count = await getUserCrushesCount(targetUserId);
    return {
      hasCrushed: false,
      newCount: count,
      error: 'No puedes marcar tu propio perfil como crush.'
    };
  }

  try {
    const { data: existing } = await supabase
      .from('users_crushes')
      .select('id')
      .eq('target_user_id', targetUserId)
      .eq('voter_uid', voterUid)
      .maybeSingle();

    let hasCrushed = false;

    if (existing) {
      // Quitar crush (Eliminar fila)
      await supabase
        .from('users_crushes')
        .delete()
        .eq('id', existing.id);

      hasCrushed = false;
    } else {
      // Agregar crush (Insertar fila)
      await supabase
        .from('users_crushes')
        .insert({
          target_user_id: targetUserId,
          voter_uid: voterUid
        });

      hasCrushed = true;
    }

    // Recalcular conteo
    const { data: allCrushes } = await supabase
      .from('users_crushes')
      .select('id')
      .eq('target_user_id', targetUserId);

    const newCount = allCrushes ? allCrushes.length : 0;
    syncUserCrushesCount(targetUserId, newCount);

    return {
      hasCrushed,
      newCount
    };
  } catch (err) {
    console.warn('Aviso al alternar crush:', err);
    const newCount = await getUserCrushesCount(targetUserId);
    return { hasCrushed: false, newCount };
  }
}
