/**
 * backblaze.ts
 * Servicio para subir avatares comprimidos a Backblaze B2 y sincronizar con Supabase y Firebase Auth.
 * Compatible con Cloudflare Pages (functions/api/upload-avatar) y fallback al backend proxy.
 */

import { supabase } from './supabase';
import { updateAuthUserProfile, getStoredUser } from './auth';
import { CompressionResult } from './imageCompressor';

export interface UploadAvatarResponse {
  success: boolean;
  publicUrl: string;
  fileId?: string;
  sizeKb?: number;
}

// URL de fallback del backend en la nube en caso de que el dominio actual no tenga el endpoint activo (p.ej. hosting estático)
const BACKEND_FALLBACK_URL = 'https://ais-dev-bpjeojps6jlbmsudaikv23-359303043265.us-west1.run.app';

/**
 * Sube la imagen comprimida a Backblaze B2 a través del endpoint seguro /api/upload-avatar
 */
export async function uploadAvatarToBackblaze(
  userId: string,
  compressed: CompressionResult,
  previousPhotoUrl?: string | null
): Promise<UploadAvatarResponse> {
  const payload = {
    imageBase64: compressed.base64,
    contentType: compressed.format,
    userId,
    previousPhotoUrl: previousPhotoUrl || null,
  };

  const payloadString = JSON.stringify(payload);

  // Lista de endpoints a intentar en orden de preferencia:
  // 1. Endpoint relativo en el dominio actual (/api/upload-avatar) - Funciona en local y Cloudflare Pages Functions
  // 2. Endpoint absoluto del backend en la nube como fallback seguro si el hosting estático responde 404 o 405
  const endpointsToTry = ['/api/upload-avatar'];
  
  if (typeof window !== 'undefined' && !window.location.origin.includes('localhost') && !window.location.origin.includes('ais-dev')) {
    endpointsToTry.push(`${BACKEND_FALLBACK_URL}/api/upload-avatar`);
  }

  let lastError = '';

  for (const endpoint of endpointsToTry) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payloadString,
      });

      const responseText = await response.text();
      let data: any = null;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        data = { rawText: responseText };
      }

      if (response.ok && data?.success) {
        return {
          success: true,
          publicUrl: data.publicUrl,
          fileId: data.fileId,
          sizeKb: data.sizeKb,
        };
      }

      // Si es un error 404 o 405 (método no permitido en hosting estático), intentamos el siguiente endpoint
      if (response.status === 404 || response.status === 405) {
        lastError = `Servidor respondió ${response.status} en ${endpoint}`;
        continue;
      }

      // Si devolvió un error JSON explícito del servidor B2
      if (data?.error) {
        throw new Error(data.error);
      }

      lastError = `Error ${response.status}: ${data?.message || responseText || 'Fallo desconocido'}`;
    } catch (netErr: any) {
      // Si fue un error de parseo o fallo de red, intentar siguiente si hay disponible
      lastError = netErr?.message || 'Error de conexión';
    }
  }

  throw new Error(lastError || 'No se pudo conectar con el servicio de subida a Backblaze B2');
}

/**
 * Limpia y corrige la URL del avatar para asegurar que use el subdominio DNS activo 'media.starryz5.com'
 */
export function formatAvatarUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.includes('cdn.starryz5.com')) {
    return url.replace('cdn.starryz5.com', 'media.starryz5.com');
  }
  return url;
}

/**
 * Actualiza la URL del avatar en Supabase y en Firebase Auth de forma sincronizada
 */
export async function syncUserAvatarProfile(
  firebaseUid: string,
  publicUrl: string
): Promise<{ success: boolean; photoUrl: string }> {
  const cleanUrl = formatAvatarUrl(publicUrl);

  // 1. Actualizar en Supabase (tabla 'users')
  let updateQuery = supabase.from('users').update({ photo_url: cleanUrl });
  if (firebaseUid.includes('@')) {
    updateQuery = updateQuery.eq('email', firebaseUid);
  } else {
    updateQuery = updateQuery.eq('id', firebaseUid);
  }
  const { error: sbError } = await updateQuery;

  if (sbError) {
    console.error('Error al actualizar photo_url en Supabase:', sbError);
    throw new Error(`Error en Supabase: ${sbError.message}`);
  }

  // 2. Actualizar en sesión local si el usuario actual coincide
  const currentUser = getStoredUser();
  if (currentUser && currentUser.uid === firebaseUid) {
    updateAuthUserProfile({ photoURL: cleanUrl });
  }

  return {
    success: true,
    photoUrl: cleanUrl,
  };
}
