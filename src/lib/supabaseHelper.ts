import { supabase } from './supabase';

/**
 * Helper seguro para filtrar consultas en la tabla 'users' por el usuario autenticado.
 * Evita consultas sin WHERE que devuelvan registros arbitrarios o concedan permisos indebidos.
 */
export function applyUserQuery<T = any>(query: any, user: any): T {
  if (!query || !user) {
    // Si no se proporcionó usuario, forzar que la consulta no coincida con nada para evitar devolver el primer registro
    return (typeof query?.eq === 'function' ? query.eq('id', '00000000-0000-0000-0000-000000000000') : query) as T;
  }

  // Si user es un string (id o email)
  if (typeof user === 'string') {
    const clean = user.trim();
    if (clean.includes('@')) {
      return query.eq('email', clean) as T;
    }
    return query.eq('id', clean) as T;
  }

  // Si user es un objeto de usuario de sesión (AuthUser)
  if (user.email && typeof user.email === 'string') {
    return query.eq('email', user.email.trim()) as T;
  }

  if (user.uid && typeof user.uid === 'string') {
    return query.eq('id', user.uid.trim()) as T;
  }

  if (user.id && typeof user.id === 'string') {
    return query.eq('id', user.id.trim()) as T;
  }

  return (typeof query?.eq === 'function' ? query.eq('id', '00000000-0000-0000-0000-000000000000') : query) as T;
}

export default {
  applyUserQuery,
  supabase,
};
