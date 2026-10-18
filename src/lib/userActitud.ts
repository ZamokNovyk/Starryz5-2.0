import { supabase } from './supabase';

export interface UserActitudItem {
  id: string;
  voter_uid: string;
  target_user_id: string;
  attitude_type: 'yo_te_conozco' | 'fans';
  created_at: string;
}

/**
 * Actualiza directamente las columnas acumuladas 'knows_count' y 'fans_count' en la tabla 'users'
 */
async function syncUserTableCounts(targetUserId: string, knowCount: number, fanCount: number) {
  if (!targetUserId) return;
  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetUserId);
    if (isUUID) {
      await supabase
        .from('users')
        .update({
          knows_count: knowCount,
          fans_count: fanCount
        })
        .eq('id', targetUserId);
    }
  } catch (e) {
    console.warn('Aviso al sincronizar contadores en tabla users:', e);
  }
}

/**
 * Obtiene el conteo de votos de Yo te conozco y Fans.
 * Intenta leer primero de las columnas 'knows_count' y 'fans_count' en 'users'.
 * Si no existiesen aún o son nulas, realiza la suma directa en 'users_actitud'.
 */
export async function getUserActitudCounts(
  targetUserId: string,
  alternateIds?: string[]
): Promise<{ knowCount: number; fanCount: number }> {
  if (!targetUserId) return { knowCount: 0, fanCount: 0 };

  try {
    const candidateIds = Array.from(new Set([targetUserId, ...(alternateIds || [])].filter(Boolean)));

    // 1. Contar filas reales en 'users_actitud' como fuente de verdad
    const { data: actitudData, error } = await supabase
      .from('users_actitud')
      .select('attitude_type')
      .in('target_user_id', candidateIds);

    let knowCount = 0;
    let fanCount = 0;

    if (!error && Array.isArray(actitudData)) {
      knowCount = actitudData.filter(i => i.attitude_type === 'yo_te_conozco' || i.attitude_type === 'knows').length;
      fanCount = actitudData.filter(i => i.attitude_type === 'fans' || i.attitude_type === 'fan').length;
    }

    // 2. Fallback o preservación desde columnas en 'users'
    const uuidId = candidateIds.find(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
    if (uuidId) {
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('knows_count, fans_count')
          .eq('id', uuidId)
          .maybeSingle();

        if (userData) {
          if (typeof userData.knows_count === 'number') {
            knowCount = Math.max(knowCount, userData.knows_count);
          }
          if (typeof userData.fans_count === 'number') {
            fanCount = Math.max(fanCount, userData.fans_count);
          }
        }
      } catch (e) {}
    }

    return { knowCount, fanCount };
  } catch (err) {
    console.warn('Aviso al obtener conteo de actitud:', err);
    return { knowCount: 0, fanCount: 0 };
  }
}

/**
 * Obtiene el voto actual del votante sobre el perfil objetivo ('yo_te_conozco' | 'fans' | null)
 */
export async function getUserActitudVotes(
  targetUserId: string,
  voterUid: string,
  alternateIds?: string[]
): Promise<{ currentVote: 'yo_te_conozco' | 'fans' | null }> {
  if (!targetUserId || !voterUid || targetUserId === voterUid) {
    return { currentVote: null };
  }

  try {
    const candidateIds = Array.from(new Set([targetUserId, ...(alternateIds || [])].filter(Boolean)));
    const { data, error } = await supabase
      .from('users_actitud')
      .select('attitude_type')
      .in('target_user_id', candidateIds)
      .eq('voter_uid', voterUid)
      .limit(1)
      .maybeSingle();

    if (error || !data) return { currentVote: null };

    return { currentVote: data.attitude_type as 'yo_te_conozco' | 'fans' };
  } catch (err) {
    console.warn('Aviso al obtener estado de voto de actitud:', err);
    return { currentVote: null };
  }
}

/**
 * Consulta simplificada si el votante ha dado Yo te conozco o Fan a un usuario
 */
export async function hasUserVotedActitud(
  targetUserId: string,
  voterUid: string
): Promise<{ knows: boolean; fans: boolean }> {
  const { currentVote } = await getUserActitudVotes(targetUserId, voterUid);
  return {
    knows: currentVote === 'yo_te_conozco',
    fans: currentVote === 'fans'
  };
}

/**
 * Alias de compatibilidad para toggleUserActitudVote
 */
export const toggleUserActitud = toggleUserActitudVote;

/**
 * Alterna o cambia el voto de actitud (Exclusivo: 1 solo voto activo por usuario)
 * Actualiza tanto 'users_actitud' como los contadores cacheados 'knows_count' y 'fans_count' en 'users'.
 */
export async function toggleUserActitudVote(
  targetUserId: string,
  voterUid: string,
  requestedType: 'yo_te_conozco' | 'fans'
): Promise<{
  activeVote: 'yo_te_conozco' | 'fans' | null;
  newCounts: { knowCount: number; fanCount: number };
  error?: string;
}> {
  // BLOQUEO 1: Prevenir autovoto
  if (targetUserId === voterUid) {
    const counts = await getUserActitudCounts(targetUserId);
    return {
      activeVote: null,
      newCounts: counts,
      error: 'No puedes votar por ti mismo.'
    };
  }

  try {
    // Buscar voto existente
    const { data: existing } = await supabase
      .from('users_actitud')
      .select('id, attitude_type')
      .eq('target_user_id', targetUserId)
      .eq('voter_uid', voterUid)
      .maybeSingle();

    let activeVote: 'yo_te_conozco' | 'fans' | null = null;

    if (existing) {
      if (existing.attitude_type === requestedType) {
        // Clic en el mismo voto -> QUITAR VOTO (Desvotar)
        await supabase
          .from('users_actitud')
          .delete()
          .eq('id', existing.id);

        activeVote = null;
      } else {
        // Clic en el otro botón -> CAMBIAR VOTO
        const { error: updateErr } = await supabase
          .from('users_actitud')
          .update({ attitude_type: requestedType })
          .eq('id', existing.id);

        if (updateErr) {
          await supabase.from('users_actitud').delete().eq('id', existing.id);
          await supabase.from('users_actitud').insert({
            target_user_id: targetUserId,
            voter_uid: voterUid,
            attitude_type: requestedType
          });
        }

        activeVote = requestedType;
      }
    } else {
      // No existe voto previo -> INSERTAR
      await supabase
        .from('users_actitud')
        .insert({
          target_user_id: targetUserId,
          voter_uid: voterUid,
          attitude_type: requestedType
        });

      activeVote = requestedType;
    }

    // Recalcular conteo real
    const { data: allVotes } = await supabase
      .from('users_actitud')
      .select('attitude_type')
      .eq('target_user_id', targetUserId);

    const knowCount = allVotes ? allVotes.filter(v => v.attitude_type === 'yo_te_conozco').length : 0;
    const fanCount = allVotes ? allVotes.filter(v => v.attitude_type === 'fans').length : 0;

    // Actualizar contadores en la tabla 'users'
    syncUserTableCounts(targetUserId, knowCount, fanCount);

    return {
      activeVote,
      newCounts: { knowCount, fanCount }
    };
  } catch (err) {
    console.warn('Aviso al alternar voto de actitud:', err);
    const newCounts = await getUserActitudCounts(targetUserId);
    return { activeVote: null, newCounts };
  }
}
