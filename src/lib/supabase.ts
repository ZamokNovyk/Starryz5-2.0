import { createClient } from '@supabase/supabase-js';

// Retrieve environment variables with compatibility for both Vite (import.meta.env) and Next.js (process.env)
const getEnvVar = (key: string): string => {
  try {
    // Check Vite environment variables
    // @ts-ignore - import.meta.env handling for Vite build target compatibility
    if (typeof import.meta !== 'undefined' && import.meta && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    // Fallback if import.meta is not available
  }

  try {
    // Check Next.js / Node process environment variables
    if (typeof process !== 'undefined' && process && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch (e) {
    // Fallback if process is not available
  }

  return '';
};

const supabaseUrl = 
  getEnvVar('VITE_SUPABASE_URL') || 
  getEnvVar('NEXT_PUBLIC_SUPABASE_URL') || 
  'https://xyzplaceholder.supabase.co';

const supabaseAnonKey = 
  getEnvVar('VITE_SUPABASE_ANON_KEY') || 
  getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY') || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2Nzc2MDA0MDAsImV4cCI6MjA5MzE3NjQwMH0.placeholder';

// Create Supabase client with safety fallback to prevent crashing when keys are unset
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: typeof window !== 'undefined',
    autoRefreshToken: typeof window !== 'undefined',
  },
});

export default supabase;
