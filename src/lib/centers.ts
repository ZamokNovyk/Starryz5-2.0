import { supabase } from './supabase';

export interface EducationalCenter {
  id: string;
  name: string;
  type: 'colegio' | 'instituto' | 'universidad';
  profile_photo_url: string | null;
  description?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  youtube_url?: string | null;
  twitter_url?: string | null;
  views_count?: number;
  created_by: string;
  created_at: string;
}

export interface CreateCenterData {
  name: string;
  type: 'colegio' | 'instituto' | 'universidad';
  photoUrl?: string;
}

/**
 * Inserta un nuevo centro educativo en la tabla 'educational_centers' de Supabase (0 MAU en Supabase Auth).
 */
export async function createEducationalCenter(data: CreateCenterData, firebaseUid: string): Promise<EducationalCenter> {
  if (!data.name || !data.name.trim()) {
    throw new Error('El nombre del centro educativo es requerido.');
  }

  const { data: inserted, error } = await supabase
    .from('educational_centers')
    .insert([
      {
        name: data.name.trim(),
        type: data.type,
        profile_photo_url: data.photoUrl?.trim() || null,
        created_by: firebaseUid,
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error al insertar centro educativo en Supabase:', error);
    throw new Error(error.message || 'No se pudo crear el centro educativo en la base de datos.');
  }

  return inserted as EducationalCenter;
}

/**
 * Recupera todos los centros educativos creados por los usuarios en Supabase.
 */
export async function getEducationalCenters(): Promise<EducationalCenter[]> {
  try {
    const { data, error } = await supabase
      .from('educational_centers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'P0001' || error.message?.includes('does not exist')) {
        return [];
      }
      console.warn('Aviso al obtener centros educativos de Supabase:', error.message || error);
      return [];
    }

    return (data as EducationalCenter[]) || [];
  } catch (err) {
    console.warn('Excepción de red al obtener centros educativos:', err);
    return [];
  }
}

/**
 * Elimina un centro educativo de la tabla 'educational_centers' en Supabase.
 */
export async function deleteEducationalCenter(centerId: string): Promise<void> {
  const { error } = await supabase
    .from('educational_centers')
    .delete()
    .eq('id', centerId);

  if (error) {
    console.error('Error al eliminar centro educativo en Supabase:', error);
    throw new Error(error.message || 'No se pudo eliminar el centro educativo.');
  }
}

/**
 * Incrementa de manera segura y atómica el contador de visualizaciones del perfil de la institución / centro educativo.
 * Utiliza sessionStorage para no spammear en recargas continuas durante la misma sesión.
 * Utiliza RPC con SECURITY DEFINER para que cualquier visitante (incluso anónimo) pueda sumar +1.
 */
export async function incrementCenterViews(centerIdOrSlug: string): Promise<number> {
  if (!centerIdOrSlug) return 0;
  const sessionKey = `starryz_viewed_center_${centerIdOrSlug}`;
  const alreadyViewedInSession = typeof window !== 'undefined' && sessionStorage.getItem(sessionKey);

  try {
    // Si ya vio en esta sesión en este navegador, solo obtenemos el conteo real sin incrementar
    if (alreadyViewedInSession) {
      const { data: centerData } = await supabase
        .from('educational_centers')
        .select('views_count')
        .or(`id.eq.${centerIdOrSlug},name.ilike.${centerIdOrSlug}`)
        .limit(1)
        .maybeSingle();

      return typeof centerData?.views_count === 'number'
        ? centerData.views_count
        : (centerData?.views_count ? Number(centerData.views_count) : 0);
    }

    // 1. Intentar registrar la vista atómicamente a través de RPC (Bypassea RLS con SECURITY DEFINER)
    try {
      const { data: rpcViews, error: rpcError } = await supabase.rpc('increment_center_views', {
        p_center_id: centerIdOrSlug,
      });

      if (!rpcError && typeof rpcViews === 'number' && rpcViews > 0) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(sessionKey, 'true');
        }
        return rpcViews;
      }
    } catch (rpcEx) {
      console.debug('Aviso RPC center views:', rpcEx);
    }

    // 2. Fallback: Obtener conteo actual y actualizar de forma directa
    const { data: centerData, error: fetchError } = await supabase
      .from('educational_centers')
      .select('id, views_count')
      .or(`id.eq.${centerIdOrSlug},name.ilike.${centerIdOrSlug}`)
      .limit(1)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.warn('Error fetching center views:', fetchError);
    }

    const targetId = centerData?.id || centerIdOrSlug;
    const currentViews = typeof centerData?.views_count === 'number' 
      ? centerData.views_count 
      : (centerData?.views_count ? Number(centerData.views_count) : 0);

    const nextViews = currentViews + 1;

    // Marcamos en sessionStorage para evitar loops en la misma pestaña
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(sessionKey, 'true');
    }

    // Actualizar en Supabase de forma directa
    await supabase
      .from('educational_centers')
      .update({ views_count: nextViews })
      .eq('id', targetId);

    return nextViews;
  } catch (err) {
    console.warn('Error al registrar visualización de centro educativo:', err);
    return 0;
  }
}

