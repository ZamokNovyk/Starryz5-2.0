import { supabase } from './supabase';
import { applyUserQuery } from './supabaseHelper';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
  role?: string | null;
  institute_id?: string | null;
  dni?: string | null;
  claimed_student_id?: string | null;
  is_verified_student?: boolean;
  profile_appeal?: boolean;
}

// Google OAuth 2.0 Client ID (Directo de Google Cloud Console - 100% Gratuito e Ilimitado)
export const GOOGLE_CLIENT_ID = "1048861626265-cvmacbok572b21bns1eq15kkf56s0t9f.apps.googleusercontent.com";

const STORAGE_KEY = 'starryz_auth_user';
const TOKEN_STORAGE_KEY = 'starryz_google_token';

// Suscriptores de estado de sesión
type AuthCallback = (user: AuthUser | null) => void;
const listeners = new Set<AuthCallback>();

function notifyListeners(user: AuthUser | null) {
  listeners.forEach((listener) => {
    try {
      listener(user);
    } catch (err) {
      console.warn('Error en listener de auth:', err);
    }
  });
}

/**
 * Registra un suscriptor para cambios en el estado de autenticación.
 */
export function onAuthStateChanged(callback: AuthCallback): () => void {
  listeners.add(callback);
  const current = getStoredUser();
  callback(current);
  if (current && !current.isAnonymous && current.email) {
    refreshAuthUser().catch(() => {});
  }
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Obtiene el usuario autenticado actualmente desde almacenamiento local.
 */
export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.email === 'wikistars12@gmail.com' || parsed.email === 'wikibot3@gmail.com') && !parsed.role) {
      parsed.role = 'admin';
    }
    return parsed;
  } catch (e) {
    return null;
  }
}

/**
 * Actualiza los datos almacenados del usuario autenticado en caliente.
 */
export function updateStoredAuthUser(updates: Partial<AuthUser>): AuthUser | null {
  const current = getStoredUser();
  if (!current) return null;
  const updated = { ...current, ...updates };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    notifyListeners(updated);
  } catch (e) {}
  return updated;
}

/**
 * Refresca los datos del usuario directamente desde la tabla 'users' de Supabase.
 */
export async function refreshAuthUser(): Promise<AuthUser | null> {
  const current = getStoredUser();
  if (!current || current.isAnonymous || !current.email) return current;

  try {
    let userQuery = supabase.from('users').select('*');
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(current.uid);
    if (current.email) {
      userQuery = userQuery.eq('email', current.email);
    } else if (isUUID) {
      userQuery = userQuery.eq('id', current.uid);
    }
    const { data: dbUser } = await userQuery.limit(1).maybeSingle();

    if (dbUser) {
      const isKnownAdmin = dbUser.role === 'admin' || dbUser.email === 'wikistars12@gmail.com' || dbUser.email === 'wikibot3@gmail.com';
      const userRole = isKnownAdmin ? 'admin' : (dbUser.role || current.role || null);
      const isClaimedUser = Boolean(dbUser.profile_appeal || dbUser.is_verified_student || dbUser.claimed_student_id);
      const updated: AuthUser = {
        ...current,
        uid: dbUser.id || current.uid,
        displayName: dbUser.nombre_completo || dbUser.display_name || current.displayName,
        photoURL: dbUser.photo_url || current.photoURL,
        role: userRole,
        institute_id: isClaimedUser ? (dbUser.institute_id || current.institute_id || null) : null,
        dni: dbUser.dni || current.dni || null,
        claimed_student_id: dbUser.claimed_student_id || current.claimed_student_id || null,
        is_verified_student: isClaimedUser,
        profile_appeal: isClaimedUser,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      notifyListeners(updated);
      return updated;
    }
  } catch (err) {
    console.warn('Aviso refrescando usuario desde Supabase:', err);
  }
  return current;
}

/**
 * Objeto de compatibilidad para código existente que consulte `auth.currentUser`.
 */
export const auth = {
  get currentUser(): AuthUser | null {
    return getStoredUser();
  }
};

/**
 * Carga el script oficial de Google Identity Services si aún no está en el DOM.
 */
export function ensureGoogleScriptLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if ((window as any).google?.accounts?.oauth2) {
      return resolve();
    }

    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Fallo al cargar script de Google Identity')));
      setTimeout(() => {
        if ((window as any).google?.accounts?.oauth2) resolve();
      }, 500);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'));
    document.head.appendChild(script);
  });
}

/**
 * Sincroniza y busca/crea al usuario en la tabla 'users' de Supabase sin depender de firebase_uid.
 * Utiliza 'email' o el 'id' (UUID) nativo de la tabla users.
 */
export async function syncUserWithSupabase(user: AuthUser): Promise<any> {
  if (!user) return null;

  try {
    if (!user.isAnonymous && user.email) {
      // 1. Buscar si ya existe por email
      const { data: existing, error: searchErr } = await supabase
        .from('users')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (existing) {
        // Asignar el id UUID real de la base de datos y campos de estudiante
        const isClaimed = Boolean(existing.profile_appeal || existing.is_verified_student || existing.claimed_student_id);
        user.uid = existing.id;
        user.institute_id = isClaimed ? (existing.institute_id || null) : null;
        user.dni = existing.dni || null;
        user.claimed_student_id = existing.claimed_student_id || null;
        user.is_verified_student = isClaimed;
        user.profile_appeal = isClaimed;

        // Si ya tiene un perfil de estudiante reclamado, no sobreescribir su nombre oficial
        const officialName = existing.nombre_completo || existing.display_name;
        if (existing.claimed_student_id && officialName) {
          user.displayName = officialName;
        }

        // Actualizar foto si cambió
        try {
          await supabase
            .from('users')
            .update({
              display_name: existing.claimed_student_id ? officialName : (user.displayName || officialName || 'Usuario'),
              photo_url: user.photoURL || existing.photo_url,
            })
            .eq('id', existing.id);
        } catch (e) {}

        return existing;
      }

      // 2. Si no existe, insertar nuevo usuario (institute_id empieza NULL)
      const { data: inserted, error: insertErr } = await supabase
        .from('users')
        .insert({
          email: user.email,
          display_name: user.displayName || 'Usuario',
          photo_url: user.photoURL || null,
          institute_id: null,
          is_verified_student: false,
        })
        .select()
        .single();

      if (insertErr) {
        console.warn('Aviso al insertar nuevo usuario en Supabase (posible RLS):', insertErr.message);
        return null;
      }

      if (inserted) {
        user.uid = inserted.id;
        return inserted;
      }
    }
    return null;
  } catch (err: any) {
    console.warn('Aviso de sincronización en Supabase:', err?.message || err);
    return null;
  }
}

/**
 * Inicia sesión usando Google OAuth 2.0 Directo (Google Identity Services).
 * 100% Gratuito e Ilimitado (Sin límites ni costos de Firebase Auth).
 */
export async function loginWithGoogle(): Promise<AuthUser> {
  await ensureGoogleScriptLoaded();

  const google = (window as any).google;
  if (!google?.accounts?.oauth2) {
    throw new Error('El servicio de Google Identity no está disponible. Revisa tu conexión a internet.');
  }

  return new Promise((resolve, reject) => {
    let resolved = false;

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        prompt: 'select_account',
        callback: async (tokenResponse: any) => {
          if (resolved) return;
          resolved = true;

          if (tokenResponse?.error) {
            if (tokenResponse.error === 'popup_closed_by_user' || tokenResponse.error === 'access_denied') {
              const cancelErr: any = new Error('Cerraste la ventana de Google antes de completar el inicio de sesión.');
              cancelErr.isUserCancellation = true;
              return reject(cancelErr);
            }
            return reject(new Error(`Error de autenticación Google: ${tokenResponse.error}`));
          }

          if (!tokenResponse?.access_token) {
            return reject(new Error('No se recibió token de acceso de Google.'));
          }

          try {
            // Guardar token temporal en localStorage
            localStorage.setItem(TOKEN_STORAGE_KEY, tokenResponse.access_token);

            // Consultar datos del perfil oficial de Google usando el token recibido
            const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
            });

            if (!userinfoRes.ok) {
              throw new Error('No se pudo obtener información del perfil de Google.');
            }

            const googleProfile = await userinfoRes.json();
            const email = googleProfile.email;
            const displayName = googleProfile.name || email?.split('@')[0] || 'Usuario';
            const photoURL = googleProfile.picture || null;

            // 1. Buscar si ya existe este usuario en Supabase por email
            let resolvedUserId = '';
            let existingDbUser: any = null;

            if (email) {
              const { data: dbUser } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .maybeSingle();

              if (dbUser?.id) {
                resolvedUserId = dbUser.id;
                existingDbUser = dbUser;
              }
            }

            // 2. Si no existía en Supabase, insertarlo (sin institute_id)
            if (!resolvedUserId && email) {
              try {
                const { data: newDbUser, error: insertErr } = await supabase
                  .from('users')
                  .insert({
                    email,
                    display_name: displayName,
                    photo_url: photoURL,
                    institute_id: null,
                  })
                  .select()
                  .single();

                if (!insertErr && newDbUser?.id) {
                  resolvedUserId = newDbUser.id;
                  existingDbUser = newDbUser;
                } else if (insertErr) {
                  console.warn('Aviso de inserción en tabla users:', insertErr.message);
                }
              } catch (insertCatch) {
                console.warn('Excepción al registrar nuevo usuario en Supabase:', insertCatch);
              }
            }

            // Fallback si la base de datos tuvo restricción RLS
            if (!resolvedUserId) {
              resolvedUserId = email;
            }

            const isKnownAdmin = existingDbUser?.role === 'admin' || email === 'wikistars12@gmail.com' || email === 'wikibot3@gmail.com';
            const userRole = isKnownAdmin ? 'admin' : (existingDbUser?.role || null);
            const isClaimedUser = Boolean(existingDbUser?.profile_appeal || existingDbUser?.claimed_student_id || existingDbUser?.is_verified_student);

            const authUser: AuthUser = {
              uid: resolvedUserId,
              displayName: existingDbUser?.nombre_completo || existingDbUser?.display_name || displayName,
              email,
              photoURL: existingDbUser?.photo_url || photoURL,
              isAnonymous: false,
              role: userRole,
              institute_id: isClaimedUser ? (existingDbUser?.institute_id || null) : null,
              dni: existingDbUser?.dni || null,
              claimed_student_id: existingDbUser?.claimed_student_id || null,
              is_verified_student: isClaimedUser,
              profile_appeal: isClaimedUser,
            };

            // Guardar sesión localmente
            localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));

            // Notificar a toda la aplicación
            notifyListeners(authUser);

            resolve(authUser);
          } catch (profileErr: any) {
            console.error('Error al procesar perfil de Google:', profileErr);
            reject(profileErr);
          }
        },
      });

      client.requestAccessToken({ prompt: 'select_account' });
    } catch (clientErr: any) {
      console.error('Error al inicializar cliente de Google OAuth:', clientErr);
      reject(clientErr);
    }
  });
}

/**
 * Inicia sesión anónima (almacenamiento local seguro).
 */
export async function loginAnonymously(): Promise<AuthUser> {
  const anonUid = `anon_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
  
  const authUser: AuthUser = {
    uid: anonUid,
    displayName: 'Usuario Anónimo',
    email: null,
    photoURL: null,
    isAnonymous: true,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
  notifyListeners(authUser);

  return authUser;
}

/**
 * Cierra la sesión activa.
 */
export async function logout(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOKEN_STORAGE_KEY);

  try {
    const google = (window as any).google;
    if (google?.accounts?.id?.disableAutoSelect) {
      google.accounts.id.disableAutoSelect();
    }
  } catch (e) {}

  notifyListeners(null);
}

/**
 * Vincula la cuenta anónima actual con Google OAuth Directo.
 */
export async function linkAnonymousWithGoogle(): Promise<AuthUser> {
  return await loginWithGoogle();
}

/**
 * Actualiza los datos de perfil del usuario activo (nombre o foto) en la sesión local y en Supabase.
 */
export async function updateAuthUserProfile(updates: { displayName?: string; photoURL?: string }) {
  const current = getStoredUser();
  if (!current) return;

  const updated: AuthUser = {
    ...current,
    displayName: updates.displayName !== undefined ? updates.displayName : current.displayName,
    photoURL: updates.photoURL !== undefined ? updates.photoURL : current.photoURL,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  notifyListeners(updated);

  // Sincronizar en tabla users de Supabase por id o por email
  try {
    let query = supabase.from('users').update({
      display_name: updated.displayName,
      photo_url: updated.photoURL,
    });

    query = applyUserQuery(query, current);

    await query;
  } catch (err) {
    console.warn('Aviso al actualizar perfil en Supabase:', err);
  }
}

/**
 * Comprueba si un nombre de usuario / apodo está disponible en Supabase.
 */
export async function checkUsernameAvailable(
  username: string,
  currentUserId?: string
): Promise<{ available: boolean; message: string }> {
  const clean = username.trim();
  if (!clean) {
    return { available: false, message: 'El nombre de usuario no puede estar vacío.' };
  }

  if (clean.length < 2) {
    return { available: false, message: 'El nombre debe tener al menos 2 caracteres.' };
  }

  if (clean.length > 35) {
    return { available: false, message: 'El nombre no puede superar los 35 caracteres.' };
  }

  try {
    let query = supabase.from('users').select('id, display_name');

    if (currentUserId) {
      query = query.neq('id', currentUserId);
    }

    const { data: existing, error } = await query.ilike('display_name', clean);
    if (error) {
      console.warn('Error al verificar disponibilidad:', error.message);
      return { available: true, message: 'Nombre disponible' };
    }

    const isTaken = existing && existing.length > 0;
    return {
      available: !isTaken,
      message: !isTaken ? 'Nombre disponible' : 'Este nombre ya está en uso',
    };
  } catch (err) {
    console.warn('Excepción al comprobar username:', err);
    return { available: true, message: 'Nombre disponible' };
  }
}
