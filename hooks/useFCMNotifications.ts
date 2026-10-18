import { useEffect, useState, useCallback, useRef } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from '@/src/lib/firebase';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/context/AuthContext';
import { dispatchFCMNotificationEvent } from '@/src/lib/notificationHelper';

const DEFAULT_VAPID_KEY = "BB6-Vfe1DmpPKhZU_CDp2tyFvM2q8i_eXbzEWgZhF2uC3fV2zKaRcGlhy1u_AaLPRiyOsK-tnLQ0Zj_GDG82P9c";

export interface FCMToastData {
  title: string;
  body: string;
  linkUrl?: string;
}

export function useFCMNotifications() {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [toastNotification, setToastNotification] = useState<FCMToastData | null>(null);
  const isInitializingRef = useRef(false);

  // Función nativa para guardar/actualizar token en 'user_fcm_tokens' de Supabase (0 MAU)
  const saveTokenToSupabase = useCallback(async (fcmToken: string, userUid: string) => {
    if (!fcmToken || !userUid) return;

    try {
      const { error } = await supabase
        .from('user_fcm_tokens')
        .upsert({
          user_uid: userUid,
          fcm_token: fcmToken,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_uid'
        });

      if (error) {
        console.error('[FCM] Error al guardar en user_fcm_tokens:', error.message);
      } else {
        console.log(`%c[FCM] Token FCM registrado con éxito: ${fcmToken}`, 'color: #22c55e; font-weight: bold;');
      }
    } catch (err) {
      console.error('[FCM] Excepción al guardar token FCM en Supabase:', err);
    }
  }, []);

  // Función para registrar Service Worker y obtener Token de FCM
  const initializeFCM = useCallback(async (currentUserId?: string, forceRequest: boolean = false) => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return null;
    }

    try {
      const supported = await isSupported();
      if (!supported) return null;

      let currentPermission = Notification.permission;
      setPermission(currentPermission);

      // Si forzamos la solicitud (porque el usuario presionó el botón en la UI) y aún está en 'default'
      if (forceRequest && currentPermission === 'default') {
        try {
          currentPermission = await Notification.requestPermission();
          setPermission(currentPermission);
        } catch (permErr) {
          console.warn('[FCM] Permiso no concedido:', permErr);
        }
      }

      // Si no ha dado permiso, no forzamos
      if (currentPermission !== 'granted') {
        return null;
      }

      // Registrar Service Worker
      let swRegistration: ServiceWorkerRegistration;
      try {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/'
        });
        await navigator.serviceWorker.ready;
        console.log('[FCM] Service Worker registrado con éxito: /firebase-messaging-sw.js');
      } catch (swErr) {
        console.error('[FCM] Error al registrar Service Worker:', swErr);
        return null;
      }

      // Obtener el Token FCM
      const messaging = getMessaging(app);
      const vapidKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_VAPID_KEY) 
        ? import.meta.env.VITE_FIREBASE_VAPID_KEY 
        : DEFAULT_VAPID_KEY;

      const currentToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: swRegistration
      });

      if (currentToken) {
        setToken(currentToken);

        const targetUid = currentUserId || user?.uid;
        if (targetUid) {
          await saveTokenToSupabase(currentToken, targetUid);
        }

        return currentToken;
      }
    } catch (err: any) {
      console.error('[FCM] Error durante la inicialización de FCM:', err);
    }
    return null;
  }, [user?.uid, saveTokenToSupabase]);

  // Función pública para solicitar permisos manualmente (al hacer clic en el modal contextual)
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        await initializeFCM(user?.uid, true);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('[FCM] Error al solicitar permiso de notificación:', e);
      return false;
    }
  }, [initializeFCM, user?.uid]);

  // Efecto principal de inicialización al cargar o al cambiar de usuario
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;
    let unsubscribeMessage: (() => void) | undefined;

    const runSetup = async () => {
      if (isInitializingRef.current) return;
      isInitializingRef.current = true;

      try {
        // Solo inicializa silenciosamente si el permiso ya fue concedido previamente
        if (Notification.permission === 'granted') {
          await initializeFCM(user?.uid, false);
        } else {
          setPermission(Notification.permission);
        }

        // Configurar listener para mensajes en primer plano (Foreground FCM onMessage)
        try {
          const supported = await isSupported();
          if (supported) {
            const messaging = getMessaging(app);
            unsubscribeMessage = onMessage(messaging, (payload) => {
              const title = payload.notification?.title || payload.data?.title || 'Starryz 5';
              const body = payload.notification?.body || payload.data?.body || 'Tienes una nueva interacción';
              const linkUrl = payload.data?.link_url || payload.data?.url || payload.fcmOptions?.link;

              // 1. Reproducir sonido de notificación correspondiente
              try {
                const payloadData = payload.data || {};
                const eventType = (payloadData.event_type || payloadData.eventType || '').toLowerCase();
                const category = (payloadData.category || '').toLowerCase();
                const type = (payloadData.type || '').toLowerCase();
                const titleLower = (title || '').toLowerCase();
                const bodyLower = (body || '').toLowerCase();

                // El sonido especial 'iloveyou.mp3' ÚNICAMENTE se debe reproducir cuando:
                // - El perfil gana un nuevo flechazo (crush_added / nuevo flechazo)
                // - O le dejan una confesión o mensaje de amor (love_message)
                // NUNCA si se pierde o retira un flechazo (crush_removed), ni para otras notificaciones
                const isLossOrRemoved = 
                  eventType === 'crush_removed' ||
                  eventType === 'fan_removed' ||
                  category === 'crush_removed' ||
                  category === 'fan_removed' ||
                  titleLower.includes('retirado') ||
                  bodyLower.includes('retirado') ||
                  titleLower.includes('💔');

                const isGainedCrushOrLove = 
                  !isLossOrRemoved && (
                    payloadData.sound === 'iloveyou.mp3' ||
                    eventType === 'crush_added' ||
                    eventType === 'love_message' ||
                    category === 'crush_added' ||
                    category === 'love_message' ||
                    titleLower.includes('nuevo flechazo') ||
                    titleLower.includes('confesión de amor') ||
                    bodyLower.includes('marcar como su crush') ||
                    bodyLower.includes('mensaje de amor')
                  );

                const audioSrc = isGainedCrushOrLove ? '/sonidos/iloveyou.mp3' : '/sonidos/noti.mp3';
                const audio = new Audio(audioSrc);
                audio.volume = 0.75;
                audio.play().catch(() => {});
              } catch {}

              // 2. Disparar evento interno para actualizar la campanita del Header en vivo (0 Realtime Supabase)
              dispatchFCMNotificationEvent({
                id: payload.messageId,
                title,
                body,
                linkUrl,
                data: payload.data,
                created_at: new Date().toISOString()
              });

              // 3. Mostrar Toast flotante
              if (isMounted) {
                setToastNotification({
                  title,
                  body,
                  linkUrl
                });

                setTimeout(() => {
                  if (isMounted) setToastNotification(null);
                }, 7000);
              }
            });
          }
        } catch {}
      } finally {
        isInitializingRef.current = false;
      }
    };

    runSetup();

    return () => {
      isMounted = false;
      if (unsubscribeMessage) {
        unsubscribeMessage();
      }
    };
  }, [user?.uid, initializeFCM]);

  // Sincronización en Supabase si el token existe y el usuario inicia sesión
  useEffect(() => {
    if (user?.uid && token) {
      saveTokenToSupabase(token, user.uid);
    }
  }, [user?.uid, token, saveTokenToSupabase]);

  const closeToast = useCallback(() => {
    setToastNotification(null);
  }, []);

  return {
    token,
    permission,
    toastNotification,
    closeToast,
    requestPermission,
    initializeFCM
  };
}
