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

export interface UserInteractionViewItem {
  id: string;
  type: 'knows' | 'fans' | 'ratings';
  targetId: string;
  targetName: string;
  targetAvatar: string | null;
  targetGender?: string | null;
  targetCountry?: string | null;
  targetCountryCode?: string | null;
  targetSubtitle?: string;
  targetScore?: number;
  starsGiven?: number;
  createdAt: string;
}

/**
 * Obtiene todas las interacciones realizadas por el usuario:
 * - Votos "Yo te conozco" en 'users_actitud'
 * - Votos "Fans" en 'users_actitud'
 * - Calificaciones otorgadas en 'user_reseñas'
 * Enriquecidas con datos del usuario/estudiante calificado.
 */
export async function getUserGivenInteractions(
  voterUids: string[]
): Promise<UserInteractionViewItem[]> {
  const cleanUids = Array.from(new Set(voterUids.filter(Boolean)));
  if (cleanUids.length === 0) return [];

  try {
    // 1. Consultar users_actitud para 'yo_te_conozco' y 'fans'
    const { data: actitudData, error: actitudErr } = await supabase
      .from('users_actitud')
      .select('*')
      .in('voter_uid', cleanUids)
      .order('created_at', { ascending: false });

    if (actitudErr) {
      console.warn('Aviso consultando users_actitud en getUserGivenInteractions:', actitudErr);
    }

    // 2. Consultar user_reseñas para calificaciones otorgadas
    const { data: reviewsData, error: reviewsErr } = await supabase
      .from('user_reseñas')
      .select('*')
      .in('voter_uid', cleanUids)
      .order('created_at', { ascending: false });

    if (reviewsErr) {
      console.warn('Aviso consultando user_reseñas en getUserGivenInteractions:', reviewsErr);
    }

    // 3. Obtener todos los IDs de personas/estudiantes interactuados
    const targetIds = Array.from(
      new Set([
        ...(actitudData || []).map((r: any) => r.target_user_id),
        ...(reviewsData || []).map((r: any) => r.target_user_id),
      ].filter(Boolean) as string[])
    );

    // 4. Enriquecer con datos de 'users' y 'students'
    const profileMap = new Map<string, {
      name: string;
      avatar: string | null;
      gender?: string | null;
      country?: string | null;
      countryCode?: string | null;
      score?: number;
      subtitle?: string;
    }>();

    if (targetIds.length > 0) {
      // 1. Consultar tabla 'users' únicamente en las columnas solicitadas
      try {
        const { data: usersInfo, error: usersErr } = await supabase
          .from('users')
          .select('id, display_name, photo_url, country_code, gender')
          .in('id', targetIds);

        if (usersErr) {
          console.warn('Aviso consultando tabla users en getUserGivenInteractions:', usersErr);
        }

        if (usersInfo && usersInfo.length > 0) {
          for (const u of usersInfo) {
            profileMap.set(u.id, {
              name: u.display_name || 'Estudiante',
              avatar: u.photo_url || null,
              gender: u.gender || null,
              countryCode: u.country_code || null,
              subtitle: 'Estudiante Starryz'
            });
          }
        }
      } catch (e) {
        console.warn('Aviso obteniendo usuarios en perfil de interacciones:', e);
      }

      // 2. Consultar tabla 'students' para perfiles de estudiantes
      try {
        const { data: studentsInfo, error: studentsErr } = await supabase
          .from('students')
          .select('id, nombre_completo, nombre, apellidos, avatar_url, score, gender, dni, claimed_by_uid')
          .in('id', targetIds);

        if (studentsErr) {
          console.warn('Aviso consultando tabla students en getUserGivenInteractions:', studentsErr);
        }

        if (studentsInfo && studentsInfo.length > 0) {
          for (const s of studentsInfo) {
            const studentRealName = s.nombre_completo || [s.nombre, s.apellidos].filter(Boolean).join(' ').trim() || 'Estudiante';
            const existing = profileMap.get(s.id) || {};
            profileMap.set(s.id, {
              name: studentRealName || existing.name || 'Estudiante',
              avatar: s.avatar_url || existing.avatar || null,
              gender: s.gender || existing.gender || null,
              country: existing.country || null,
              countryCode: existing.countryCode || null,
              score: typeof s.score === 'number' ? Number(s.score) : existing.score,
              subtitle: 'Estudiante Verificado'
            });
          }
        }
      } catch (e) {
        console.warn('Aviso obteniendo estudiantes en perfil de interacciones:', e);
      }
    }

    const results: UserInteractionViewItem[] = [];

    // Mapear interacciones de users_actitud
    if (actitudData && actitudData.length > 0) {
      for (const row of actitudData) {
        const info = profileMap.get(row.target_user_id) || {};
        const isKnows = row.attitude_type === 'yo_te_conozco' || row.attitude_type === 'knows';
        results.push({
          id: row.id,
          type: isKnows ? 'knows' : 'fans',
          targetId: row.target_user_id,
          targetName: info.name || 'Estudiante Starryz',
          targetAvatar: info.avatar || null,
          targetGender: info.gender || null,
          targetCountry: info.country || null,
          targetCountryCode: info.countryCode || null,
          targetScore: info.score,
          targetSubtitle: isKnows ? 'Siguiendo' : 'Voto de Fan',
          createdAt: row.created_at || new Date().toISOString(),
        });
      }
    }

    // Mapear calificaciones de user_reseñas
    if (reviewsData && reviewsData.length > 0) {
      for (const row of reviewsData) {
        const info = profileMap.get(row.target_user_id) || {};
        results.push({
          id: row.id,
          type: 'ratings',
          targetId: row.target_user_id,
          targetName: info.name || 'Estudiante Starryz',
          targetAvatar: info.avatar || null,
          targetGender: info.gender || null,
          targetCountry: info.country || null,
          targetCountryCode: info.countryCode || null,
          targetScore: info.score,
          targetSubtitle: 'Calificación otorgada',
          starsGiven: Number(row.stars) || 5,
          createdAt: row.created_at || new Date().toISOString(),
        });
      }
    }

    // Opcional: Interacciones con profesores si existen en professor_interactions
    try {
      const { data: profData } = await supabase
        .from('professor_interactions')
        .select('*')
        .in('user_id', cleanUids);

      if (profData && profData.length > 0) {
        for (const p of profData) {
          if (p.type === 'knows' || p.type === 'fan') {
            results.push({
              id: p.id,
              type: p.type === 'knows' ? 'knows' : 'fans',
              targetId: p.professor_id,
              targetName: p.professor_name || 'Profesor',
              targetAvatar: p.professor_avatar || null,
              targetSubtitle: p.professor_role || (p.type === 'knows' ? 'Profesor conocido' : 'Fan de profesor'),
              createdAt: p.created_at || new Date().toISOString(),
            });
          }
        }
      }
    } catch (_) {}

    // Ordenar de más reciente a más antiguo
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return results;
  } catch (err) {
    console.error('Error al cargar interacciones completas:', err);
    return [];
  }
}

/**
 * Retira una interacción (voto de actitud o calificación)
 */
export async function removeUserGivenInteraction(
  item: UserInteractionViewItem
): Promise<boolean> {
  if (!item || !item.id) return false;

  try {
    if (item.type === 'knows' || item.type === 'fans') {
      const { error } = await supabase
        .from('users_actitud')
        .delete()
        .eq('id', item.id);

      if (error) {
        // Podría provenir de professor_interactions
        await supabase.from('professor_interactions').delete().eq('id', item.id);
      } else if (item.targetId) {
        // Actualizar contadores acumulados
        const counts = await getUserActitudCounts(item.targetId);
        await syncUserTableCounts(item.targetId, counts.knowCount, counts.fanCount);
      }
      return true;
    } else if (item.type === 'ratings') {
      const { error } = await supabase
        .from('user_reseñas')
        .delete()
        .eq('id', item.id);

      return !error;
    }
    return false;
  } catch (e) {
    console.error('Error retirando interacción:', e);
    return false;
  }
}

