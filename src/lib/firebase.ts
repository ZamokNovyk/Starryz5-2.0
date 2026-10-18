import { initializeApp, getApps, getApp } from 'firebase/app';

/**
 * firebase.ts
 * Configuración exclusiva para Firebase Cloud Messaging (FCM - Notificaciones Push).
 * 
 * 💡 NOTA DE COSTOS:
 * FCM (Push Notifications) es 100% GRATUITO E ILIMITADO para siempre por parte de Google.
 * La autenticación (Login) ya NO pasa por aquí; se maneja directamente con Google OAuth en auth.ts ($0 MAU).
 */

const getEnvVar = (key: string): string => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {}

  try {
    if (typeof process !== 'undefined' && process && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch (e) {}

  return '';
};

const defaultApiKey = "AIzaSyAPTCYvXj0t_tT8pFL3T0au4lnGWFjvBAQ";

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || defaultApiKey,
  authDomain: "starryz5-usuarios.firebaseapp.com",
  projectId: "starryz5-usuarios",
  storageBucket: "starryz5-usuarios.firebasestorage.app",
  messagingSenderId: "1048861626265",
  appId: "1:1048861626265:web:406d52cf245be964368d08"
};

// Inicializar la app de Firebase únicamente para el servicio de Notificaciones Push (FCM)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export default app;
