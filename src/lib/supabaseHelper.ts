import { supabase } from './supabase';

/**
 * Helper para compatibilidad de consultas sobre la tabla de usuarios y perfil.
 */
export function applyUserQuery<T = any>(query: T, ...args: any[]): T {
  return query;
}

export default {
  applyUserQuery,
  supabase,
};
