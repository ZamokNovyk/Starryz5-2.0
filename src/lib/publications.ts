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
