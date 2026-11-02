/**
 * publications.ts
 * Servicio para gestión de publicaciones de usuario en Starryz 5.
 * Interactúa con la tabla 'user-publications' en Supabase y el almacenamiento de imágenes.
 */

import { supabase } from './supabase';
import { compressPublicationImage, CompressionResult } from './imageCompressor';
import { uploadImageToBackblaze } from './backblaze';

export interface UserAuthorData {
  display_name?: string | null;
  gender?: string | null;
  country_code?: string | null;
  score?: number | null;
  photo_url?: string | null;
}

export interface UserPublication {
  id: string;
  user_id: string;
  created_at: string;
  image_url: string;
  star_1: number;
  star_2: number;
  star_3: number;
  star_4: number;
  star_5: number;
  rating_percentage: number;
  rating_avg: number;
  comments_count: number;
  saves_count: number;
  views_count: number;
  shares_count: number;
  description: string;
  user_display_name?: string | null;
  user_username?: string | null;
  user_avatar_url?: string | null;
  user_badge?: string | null;
  author_data?: UserAuthorData | null;
}

export interface CreatePublicationPayload {
  userId: string;
  file: File;
  description: string;
  authorInfo?: {
    displayName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
    badge?: string | null;
  };
  onProgress?: (step: 'compressing' | 'uploading' | 'saving' | 'done', stats?: { originalSize: number; compressedSize: number; savings: number }) => void;
}

/**
 * Sube una imagen de publicación a Backblaze B2 (media.starryz5.com) aprovechando Cloudflare CDN,
 * con fallback seguro a Supabase Storage y a Base64.
 */
export async function uploadPublicationImageFile(
  userId: string,
  compressed: CompressionResult
): Promise<string> {
  // 1. Intentar subir a Backblaze B2 a través de Cloudflare CDN (media.starryz5.com)
  try {
    const b2Res = await uploadImageToBackblaze(userId, compressed, { folder: 'publications' });
    if (b2Res?.success && b2Res.publicUrl) {
      return b2Res.publicUrl;
    }
  } catch (b2Err) {
    console.warn('[Publications] Subida a Backblaze B2 falló, intentando fallback:', b2Err);
  }

  // 2. Fallback a Supabase Storage si B2 no está disponible
  const fileExt = compressed.format.includes('webp') ? 'webp' : 'jpg';
  const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  try {
    const { data, error } = await supabase.storage
      .from('user-publications')
      .upload(fileName, compressed.blob, {
        contentType: compressed.format,
        cacheControl: '31536000',
        upsert: true,
      });

    if (!error && data?.path) {
      const { data: publicData } = supabase.storage
        .from('user-publications')
        .getPublicUrl(data.path);
      
      if (publicData?.publicUrl) {
        return publicData.publicUrl;
      }
    }
  } catch (storageErr) {
    console.warn('[Publications] Supabase storage upload warning (usando fallback seguro):', storageErr);
  }

  // 3. Fallback seguro en memoria: el payload base64 comprimido (aprox 95 KB)
  return compressed.base64;
}

/**
 * Obtiene las publicaciones de un usuario específico ordenadas por fecha más reciente
 * y enriquece cada publicación consultando en 'users' (display_name, gender, country_code, score, photo_url)
 */
export async function getUserPublications(userId: string): Promise<UserPublication[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('user-publications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      // Si la tabla aún no existe en Supabase, registrar aviso amigable y devolver lista vacía
      console.warn('[Publications] Error al consultar user-publications:', error.message);
      return [];
    }

    const publicationsList = (data || []) as UserPublication[];

    // Consultar datos actualizados de los autores en la tabla 'users'
    // id -> display_name, gender, country_code, score, photo_url
    const uniqueUserIds = Array.from(new Set(publicationsList.map((p) => p.user_id).filter(Boolean)));
    if (uniqueUserIds.length > 0) {
      try {
        const { data: usersData, error: usersErr } = await supabase
          .from('users')
          .select('id, display_name, gender, country_code, score, photo_url')
          .in('id', uniqueUserIds);

        if (!usersErr && usersData) {
          const userMap = new Map<string, UserAuthorData>();
          usersData.forEach((u: any) => {
            userMap.set(u.id, {
              display_name: u.display_name,
              gender: u.gender,
              country_code: u.country_code,
              score: u.score !== undefined && u.score !== null ? Number(u.score) : 5.0,
              photo_url: u.photo_url,
            });
          });

          return publicationsList.map((pub) => ({
            ...pub,
            author_data: userMap.get(pub.user_id) || null,
          }));
        }
      } catch (userQueryErr) {
        console.warn('[Publications] Error al consultar usuarios asociados:', userQueryErr);
      }
    }

    return publicationsList;
  } catch (err) {
    console.warn('[Publications] Excepción al obtener publicaciones:', err);
    return [];
  }
}

/**
 * Crea una nueva publicación:
 * 1. Comprime la imagen (máx 5MB original -> 90KB - 100KB WebP)
 * 2. Guarda la imagen en storage o base64
 * 3. Inserta el registro en 'user-publications'
 */
export async function createPublication(
  payload: CreatePublicationPayload
): Promise<UserPublication> {
  const { userId, file, description, authorInfo, onProgress } = payload;

  if (!userId) throw new Error('ID de usuario requerido para publicar.');
  if (!file) throw new Error('Debes seleccionar una imagen para publicar.');
  if (description && description.length > 500) {
    throw new Error('La descripción excede el límite máximo de 500 caracteres.');
  }

  // Paso 1: Compresión de imagen
  onProgress?.('compressing');
  const compressed = await compressPublicationImage(file);
  onProgress?.('uploading', {
    originalSize: compressed.originalSize,
    compressedSize: compressed.compressedSize,
    savings: compressed.savingsPercent,
  });

  // Paso 2: Subida de la imagen
  const imageUrl = await uploadPublicationImageFile(userId, compressed);

  // Paso 3: Inserción en la base de datos
  onProgress?.('saving');

  const insertData = {
    user_id: userId,
    image_url: imageUrl,
    description: (description || '').trim(),
    star_1: 0,
    star_2: 0,
    star_3: 0,
    star_4: 0,
    star_5: 0,
    rating_percentage: 0.00,
    rating_avg: 0.00,
    comments_count: 0,
    saves_count: 0,
    views_count: 0,
    shares_count: 0,
    user_display_name: authorInfo?.displayName || null,
    user_username: authorInfo?.username || null,
    user_avatar_url: authorInfo?.avatarUrl || null,
    user_badge: authorInfo?.badge || '👑 ELITE 4.5+',
  };

  const { data, error } = await supabase
    .from('user-publications')
    .insert([insertData])
    .select()
    .single();

  if (error) {
    console.error('[Publications] Error al insertar publicación:', error);
    throw new Error(`Error en base de datos: ${error.message}`);
  }

  onProgress?.('done');
  return data as UserPublication;
}

/**
 * Elimina una publicación propia
 */
export async function deletePublication(
  publicationId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user-publications')
      .delete()
      .eq('id', publicationId)
      .eq('user_id', userId);

    if (error) {
      console.error('[Publications] Error al eliminar publicación:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Publications] Excepción al eliminar publicación:', err);
    return false;
  }
}

/**
 * Reseñas y Comentarios de Publicaciones
 * Tabla: 'user_publicaciones_reseñas+comentarios'
 */
export interface PublicationReviewComment {
  id: string;
  publication_id: string;
  user_uid: string;
  stars: number | null;
  comment: string | null;
  user_display_name?: string | null;
  user_username?: string | null;
  user_avatar_url?: string | null;
  created_at: string;
}

const REVIEWS_TABLE = 'user_publicaciones_reseñas+comentarios';
const SAVED_TABLE = 'user_guardados';

/**
 * Obtiene los comentarios y reseñas de una publicación ordenados del más reciente al más antiguo
 */
export async function getPublicationReviews(
  publicationId: string
): Promise<PublicationReviewComment[]> {
  if (!publicationId) return [];

  try {
    const { data, error } = await supabase
      .from(REVIEWS_TABLE)
      .select('*')
      .eq('publication_id', publicationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Publications] Aviso al consultar reseñas/comentarios:', error.message);
      return [];
    }

    const list = (data || []).map((item: any) => ({
      ...item,
      id: item.id || item.uuid,
    }));

    return list as PublicationReviewComment[];
  } catch (err) {
    console.warn('[Publications] Excepción al obtener reseñas/comentarios:', err);
    return [];
  }
}

/**
 * Obtiene la calificación (estrellas) previa del usuario actual para una publicación específica
 */
export async function getUserPublicationRating(
  publicationId: string,
  userUid: string
): Promise<PublicationReviewComment | null> {
  if (!publicationId || !userUid) return null;

  try {
    const { data, error } = await supabase
      .from(REVIEWS_TABLE)
      .select('*')
      .eq('publication_id', publicationId)
      .eq('user_uid', userUid)
      .not('stars', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as any;
    return {
      ...row,
      id: row.id || row.uuid,
    } as PublicationReviewComment;
  } catch {
    return null;
  }
}

/**
 * Obtiene la reseña previa del usuario actual para una publicación específica (si ya votó o comentó)
 */
export async function getUserPublicationReview(
  publicationId: string,
  userUid: string
): Promise<PublicationReviewComment | null> {
  if (!publicationId || !userUid) return null;

  try {
    const { data, error } = await supabase
      .from(REVIEWS_TABLE)
      .select('*')
      .eq('publication_id', publicationId)
      .eq('user_uid', userUid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    const row = data as any;
    return {
      ...row,
      id: row.id || row.uuid,
    } as PublicationReviewComment;
  } catch {
    return null;
  }
}

/**
 * Recalcula y actualiza en 'user-publications' el promedio, total de votos, desglose de estrellas y cantidad de comentarios
 */
export async function recalculatePublicationMetrics(publicationId: string): Promise<{
  rating_avg: number;
  total_votes: number;
  comments_count: number;
  star_1: number;
  star_2: number;
  star_3: number;
  star_4: number;
  star_5: number;
}> {
  try {
    const { data: allReviews } = await supabase
      .from(REVIEWS_TABLE)
      .select('stars, comment')
      .eq('publication_id', publicationId);

    const reviewsList = allReviews || [];
    const starVotes = reviewsList.filter((r: any) => typeof r.stars === 'number' && r.stars >= 1 && r.stars <= 5);
    const totalVotes = starVotes.length;
    const sumStars = starVotes.reduce((acc: number, r: any) => acc + Number(r.stars), 0);
    const newRatingAvg = totalVotes > 0 ? parseFloat((sumStars / totalVotes).toFixed(2)) : 0;
    const commentsCount = reviewsList.filter((r: any) => Boolean(r.comment && r.comment.trim())).length;

    const star1 = starVotes.filter((r: any) => Number(r.stars) === 1).length;
    const star2 = starVotes.filter((r: any) => Number(r.stars) === 2).length;
    const star3 = starVotes.filter((r: any) => Number(r.stars) === 3).length;
    const star4 = starVotes.filter((r: any) => Number(r.stars) === 4).length;
    const star5 = starVotes.filter((r: any) => Number(r.stars) === 5).length;

    await supabase
      .from('user-publications')
      .update({
        rating_avg: newRatingAvg,
        rating_percentage: totalVotes > 0 ? parseFloat(((newRatingAvg / 5) * 100).toFixed(2)) : 0,
        star_1: star1,
        star_2: star2,
        star_3: star3,
        star_4: star4,
        star_5: star5,
        comments_count: commentsCount,
      })
      .eq('id', publicationId);

    return {
      rating_avg: newRatingAvg,
      total_votes: totalVotes,
      comments_count: commentsCount,
      star_1: star1,
      star_2: star2,
      star_3: star3,
      star_4: star4,
      star_5: star5,
    };
  } catch (err) {
    console.warn('[Publications] Error al recalcular métricas:', err);
    return {
      rating_avg: 0,
      total_votes: 0,
      comments_count: 0,
      star_1: 0,
      star_2: 0,
      star_3: 0,
      star_4: 0,
      star_5: 0,
    };
  }
}

/**
 * Calificación directa con puras estrellas (barra grande):
 * - Permite calificar o cambiar la calificación en cualquier momento sin bloquear al usuario.
 * - Si ya tenía calificación o reseña previa, actualiza las estrellas y recalcula métricas.
 */
export async function submitPublicationPureRating(params: {
  publicationId: string;
  userUid: string;
  stars: number;
  authorInfo?: {
    displayName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  };
}): Promise<{
  success: boolean;
  hasReviewLocked?: boolean;
  error?: string;
  updatedReview?: PublicationReviewComment;
  rating_avg?: number;
  total_votes?: number;
}> {
  const { publicationId, userUid, stars, authorInfo } = params;
  if (!publicationId || !userUid) {
    return { success: false, error: 'Debes iniciar sesión para calificar.' };
  }

  const cleanStars = Math.min(5, Math.max(1, Math.round(stars)));

  try {
    // 1. Buscar todas las calificaciones existentes de este usuario en esta publicación
    const { data: existingRows } = await supabase
      .from(REVIEWS_TABLE)
      .select('*')
      .eq('publication_id', publicationId)
      .eq('user_uid', userUid)
      .not('stars', 'is', null)
      .order('created_at', { ascending: false });

    if (existingRows && existingRows.length > 0) {
      // Tomar la primera fila y actualizar sus estrellas
      const primaryRow = existingRows[0];
      const { data, error } = await supabase
        .from(REVIEWS_TABLE)
        .update({ stars: cleanStars })
        .eq('id', primaryRow.id)
        .select();

      // Si por doble clic previo del mouse se crearon filas duplicadas, eliminar las sobrantes
      if (existingRows.length > 1) {
        const extraIds = existingRows.slice(1).map((r: any) => r.id).filter(Boolean);
        if (extraIds.length > 0) {
          try {
            await supabase.from(REVIEWS_TABLE).delete().in('id', extraIds);
          } catch {}
        }
      }

      if (error) return { success: false, error: error.message };

      const updatedRow = (data && data[0]) ? (data[0] as PublicationReviewComment) : primaryRow;
      const metrics = await recalculatePublicationMetrics(publicationId);

      return {
        success: true,
        updatedReview: updatedRow,
        rating_avg: metrics.rating_avg,
        total_votes: metrics.total_votes,
      };
    }

    // Primera vez que califica: insertar nuevo registro con estrellas
    const { data: insertedList, error: insertErr } = await supabase
      .from(REVIEWS_TABLE)
      .insert([{
        publication_id: publicationId,
        user_uid: userUid,
        stars: cleanStars,
        comment: null,
        user_display_name: authorInfo?.displayName || 'Usuario',
        user_username: authorInfo?.username || null,
        user_avatar_url: authorInfo?.avatarUrl || null,
      }])
      .select();

    if (insertErr) return { success: false, error: insertErr.message };

    const insertedRow = (insertedList && insertedList[0]) ? (insertedList[0] as PublicationReviewComment) : undefined;
    const metrics = await recalculatePublicationMetrics(publicationId);

    return {
      success: true,
      updatedReview: insertedRow,
      rating_avg: metrics.rating_avg,
      total_votes: metrics.total_votes,
    };
  } catch (err: any) {
    console.error('[Publications] Error al calificar con estrellas:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Registra o actualiza comentario o reseña:
 * - Si viene con estrellas: se vincula a la calificación del usuario y actualiza comment y/o stars.
 * - Si es puro comentario (stars == null): se inserta un nuevo comentario independiente.
 */
export async function submitPublicationReview(params: {
  publicationId: string;
  userUid: string;
  stars?: number | null;
  comment?: string | null;
  authorInfo?: {
    displayName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  };
}): Promise<{
  success: boolean;
  newReview?: PublicationReviewComment;
  rating_avg?: number;
  total_votes?: number;
  comments_count?: number;
  error?: string;
}> {
  const { publicationId, userUid, stars, comment, authorInfo } = params;

  if (!publicationId || !userUid) {
    return { success: false, error: 'Debes iniciar sesión para calificar o comentar.' };
  }

  const cleanStars = typeof stars === 'number' && stars >= 1 && stars <= 5 ? Math.round(stars) : null;
  const cleanComment = (comment || '').trim() || null;

  if (cleanStars === null && !cleanComment) {
    return { success: false, error: 'Debes ingresar una calificación de estrellas o un comentario.' };
  }

  try {
    let insertedOrUpdated: any = null;

    if (cleanStars !== null) {
      // El usuario está enviando una reseña (estrellas + comentario). Buscar si ya tiene calificación previa:
      const { data: existingRows } = await supabase
        .from(REVIEWS_TABLE)
        .select('*')
        .eq('publication_id', publicationId)
        .eq('user_uid', userUid)
        .not('stars', 'is', null)
        .order('created_at', { ascending: false });

      const existingRating = existingRows && existingRows[0] ? existingRows[0] : null;

      const updatePayload = {
        stars: cleanStars,
        comment: cleanComment,
        user_display_name: authorInfo?.displayName || existingRating?.user_display_name || 'Usuario',
        user_username: authorInfo?.username || existingRating?.user_username || null,
        user_avatar_url: authorInfo?.avatarUrl || existingRating?.user_avatar_url || null,
      };

      if (existingRating && existingRating.id) {
        // Actualizar su registro de calificación existente por id
        const { data: updatedList, error: updateErr } = await supabase
          .from(REVIEWS_TABLE)
          .update(updatePayload)
          .eq('id', existingRating.id)
          .select();

        // Limpiar cualquier duplicado adicional que haya podido generarse previamente
        if (existingRows && existingRows.length > 1) {
          const extraIds = existingRows.slice(1).map((r: any) => r.id).filter(Boolean);
          if (extraIds.length > 0) {
            try {
              await supabase.from(REVIEWS_TABLE).delete().in('id', extraIds);
            } catch {}
          }
        }

        if (updateErr) return { success: false, error: updateErr.message };

        if (updatedList && updatedList[0]) {
          insertedOrUpdated = updatedList[0];
        }
      }

      if (!insertedOrUpdated) {
        // Intentar actualizar buscando por publication_id y user_uid donde stars no sea null
        const { data: retryList } = await supabase
          .from(REVIEWS_TABLE)
          .update(updatePayload)
          .eq('publication_id', publicationId)
          .eq('user_uid', userUid)
          .not('stars', 'is', null)
          .select();

        if (retryList && retryList[0]) {
          insertedOrUpdated = retryList[0];
        }
      }

      if (!insertedOrUpdated) {
        // Si no existía registro previo, insertar nuevo
        const { data: insertedList, error: insertErr } = await supabase
          .from(REVIEWS_TABLE)
          .insert([{
            publication_id: publicationId,
            user_uid: userUid,
            ...updatePayload,
          }])
          .select();

        if (insertErr) return { success: false, error: insertErr.message };
        if (insertedList && insertedList[0]) {
          insertedOrUpdated = insertedList[0];
        }
      }
    } else {
      // Puro comentario sin estrellas: se crea un nuevo comentario independiente
      const { data: insertedList, error: insertErr } = await supabase
        .from(REVIEWS_TABLE)
        .insert([{
          publication_id: publicationId,
          user_uid: userUid,
          stars: null,
          comment: cleanComment,
          user_display_name: authorInfo?.displayName || 'Usuario',
          user_username: authorInfo?.username || null,
          user_avatar_url: authorInfo?.avatarUrl || null,
        }])
        .select();

      if (insertErr) return { success: false, error: insertErr.message };
      if (insertedList && insertedList[0]) {
        insertedOrUpdated = insertedList[0];
      }
    }

    const metrics = await recalculatePublicationMetrics(publicationId);

    return {
      success: true,
      newReview: insertedOrUpdated as PublicationReviewComment,
      rating_avg: metrics.rating_avg,
      total_votes: metrics.total_votes,
      comments_count: metrics.comments_count,
    };
  } catch (err: any) {
    console.error('[Publications] Excepción al procesar reseña:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Edita un comentario o reseña existente del usuario
 */
export async function updatePublicationReviewComment(params: {
  reviewId: string;
  publicationId: string;
  userUid: string;
  comment?: string | null;
  stars?: number | null;
}): Promise<{
  success: boolean;
  updatedReview?: PublicationReviewComment;
  rating_avg?: number;
  total_votes?: number;
  comments_count?: number;
  error?: string;
}> {
  const { reviewId, publicationId, userUid, comment, stars } = params;

  if (!reviewId || !publicationId || !userUid) {
    return { success: false, error: 'Parámetros inválidos para editar.' };
  }

  const cleanComment = (comment || '').trim() || null;
  const cleanStars = typeof stars === 'number' && stars >= 1 && stars <= 5 ? Math.round(stars) : (stars === null ? null : undefined);

  try {
    const updatePayload: any = {
      comment: cleanComment,
    };
    if (cleanStars !== undefined) {
      updatePayload.stars = cleanStars;
    }

    const { data: updatedList, error } = await supabase
      .from(REVIEWS_TABLE)
      .update(updatePayload)
      .eq('id', reviewId)
      .eq('user_uid', userUid)
      .select();

    if (error) return { success: false, error: error.message };

    const updatedRow = updatedList && updatedList[0] ? updatedList[0] : null;
    const metrics = await recalculatePublicationMetrics(publicationId);

    return {
      success: true,
      updatedReview: updatedRow as PublicationReviewComment,
      rating_avg: metrics.rating_avg,
      total_votes: metrics.total_votes,
      comments_count: metrics.comments_count,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Elimina un comentario o reseña existente del usuario y recalcula métricas
 */
export async function deletePublicationReviewComment(
  reviewId: string,
  publicationId: string,
  userUid: string
): Promise<{
  success: boolean;
  rating_avg?: number;
  total_votes?: number;
  comments_count?: number;
  error?: string;
}> {
  if (!reviewId || !publicationId || !userUid) {
    return { success: false, error: 'Parámetros inválidos para eliminar.' };
  }

  try {
    const { error } = await supabase
      .from(REVIEWS_TABLE)
      .delete()
      .eq('id', reviewId)
      .eq('user_uid', userUid);

    if (error) return { success: false, error: error.message };

    const metrics = await recalculatePublicationMetrics(publicationId);

    return {
      success: true,
      rating_avg: metrics.rating_avg,
      total_votes: metrics.total_votes,
      comments_count: metrics.comments_count,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Comprueba si el usuario tiene guardada cierta publicación en 'user_guardados'
 */
export async function isPublicationSavedByUser(
  publicationId: string,
  userUid: string
): Promise<boolean> {
  if (!publicationId || !userUid) return false;

  try {
    const { data, error } = await supabase
      .from(SAVED_TABLE)
      .select('id')
      .eq('publication_id', publicationId)
      .eq('user_uid', userUid)
      .limit(1)
      .maybeSingle();

    return Boolean(!error && data?.id);
  } catch {
    return false;
  }
}

/**
 * Guarda o quita de guardados una publicación (Toggle Guardado)
 */
export async function toggleSavePublication(
  publicationId: string,
  userUid: string,
  currentSavesCount: number = 0
): Promise<{ isSaved: boolean; saves_count: number }> {
  if (!publicationId || !userUid) {
    return { isSaved: false, saves_count: currentSavesCount };
  }

  try {
    const alreadySaved = await isPublicationSavedByUser(publicationId, userUid);
    let nextState = !alreadySaved;
    let nextCount = nextState ? currentSavesCount + 1 : Math.max(0, currentSavesCount - 1);

    if (alreadySaved) {
      await supabase
        .from(SAVED_TABLE)
        .delete()
        .eq('publication_id', publicationId)
        .eq('user_uid', userUid);
    } else {
      await supabase
        .from(SAVED_TABLE)
        .insert([{ publication_id: publicationId, user_uid: userUid }]);
    }

    // Actualizar saves_count en 'user-publications'
    try {
      await supabase
        .from('user-publications')
        .update({ saves_count: nextCount })
        .eq('id', publicationId);
    } catch {}

    return { isSaved: nextState, saves_count: nextCount };
  } catch (err) {
    console.error('[Publications] Error al alternar guardado:', err);
    return { isSaved: false, saves_count: currentSavesCount };
  }
}

/**
 * Obtiene todas las publicaciones guardadas por un usuario específico (para el tag Guardados)
 */
export async function getUserSavedPublications(userUid: string): Promise<UserPublication[]> {
  if (!userUid) return [];

  try {
    const { data: savedRows, error: savedErr } = await supabase
      .from(SAVED_TABLE)
      .select('publication_id, created_at')
      .eq('user_uid', userUid)
      .order('created_at', { ascending: false });

    if (savedErr || !savedRows || savedRows.length === 0) {
      return [];
    }

    const pubIds = savedRows.map((r: any) => r.publication_id).filter(Boolean);
    if (pubIds.length === 0) return [];

    const { data: pubsData, error: pubsErr } = await supabase
      .from('user-publications')
      .select('*')
      .in('id', pubIds);

    if (pubsErr || !pubsData) return [];

    const pubsList = pubsData as UserPublication[];

    // Enriquecer datos de autor de users
    const uniqueUserIds = Array.from(new Set(pubsList.map((p) => p.user_id).filter(Boolean)));
    if (uniqueUserIds.length > 0) {
      try {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, display_name, gender, country_code, score, photo_url')
          .in('id', uniqueUserIds);

        if (usersData) {
          const userMap = new Map<string, UserAuthorData>();
          usersData.forEach((u: any) => {
            userMap.set(u.id, {
              display_name: u.display_name,
              gender: u.gender,
              country_code: u.country_code,
              score: u.score !== undefined && u.score !== null ? Number(u.score) : 5.0,
              photo_url: u.photo_url,
            });
          });

          return pubsList.map((pub) => ({
            ...pub,
            author_data: userMap.get(pub.user_id) || null,
          }));
        }
      } catch {}
    }

    return pubsList;
  } catch (err) {
    console.warn('[Publications] Excepción al obtener publicaciones guardadas:', err);
    return [];
  }
}

/**
 * Incrementa el contador de vistas de una publicación
 */
export async function incrementPublicationView(publicationId: string): Promise<number> {
  if (!publicationId) return 0;

  try {
    const { data } = await supabase
      .from('user-publications')
      .select('views_count')
      .eq('id', publicationId)
      .maybeSingle();

    const currentViews = Number(data?.views_count || 0);
    const newViews = currentViews + 1;

    await supabase
      .from('user-publications')
      .update({ views_count: newViews })
      .eq('id', publicationId);

    return newViews;
  } catch (err) {
    return 0;
  }
}

/**
 * Incrementa el contador de compartidos de una publicación
 */
export async function incrementPublicationShare(publicationId: string): Promise<number> {
  if (!publicationId) return 0;

  try {
    const { data } = await supabase
      .from('user-publications')
      .select('shares_count')
      .eq('id', publicationId)
      .maybeSingle();

    const currentShares = Number(data?.shares_count || 0);
    const newShares = currentShares + 1;

    await supabase
      .from('user-publications')
      .update({ shares_count: newShares })
      .eq('id', publicationId);

    return newShares;
  } catch (err) {
    return 0;
  }
}

/**
 * Actualiza dinámicamente las etiquetas Open Graph y Twitter en el cliente
 * para que al compartir en redes sociales se genere la imagen y título llamativo
 */
export function updateOpenGraphMeta(params: {
  title: string;
  description: string;
  imageUrl: string;
  url?: string;
}): void {
  if (typeof document === 'undefined') return;

  const { title, description, imageUrl, url = window.location.href } = params;

  const setMeta = (attr: 'property' | 'name', key: string, content: string) => {
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  // Open Graph
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:image', imageUrl);
  setMeta('property', 'og:image:secure_url', imageUrl);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:type', 'article');

  // Twitter
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', imageUrl);
}
