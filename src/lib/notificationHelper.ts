// Helper de Notificaciones Inteligentes y Eventos en Tiempo Real (FCM / 0 Realtime Supabase)

export type ActionType = 'confession' | 'reaction' | 'comment' | 'rating' | 'center';

export interface NotificationPromptEventDetail {
  actionType: ActionType;
  title: string;
  description: string;
}

const ACTION_MESSAGES: Record<ActionType, { title: string; description: string }> = {
  confession: {
    title: '¡Confesión publicada con éxito! 🎉',
    description: '¿Deseas activar las notificaciones para enterarte al instante cuando otros estudiantes reaccionen o respondan a tus confesiones?'
  },
  reaction: {
    title: '¡Reacción registrada! ❤️',
    description: '¿Quieres enterarte en tiempo real si el autor responde o cuando haya nuevas reacciones en las confesiones del campus?'
  },
  comment: {
    title: '¡Comentario publicado! 💬',
    description: '¿Deseas recibir avisos al instante cuando te respondan o continúe la conversación en este hilo?'
  },
  rating: {
    title: '¡Calificación registrada! ⭐',
    description: '¿Quieres enterarte de nuevas evaluaciones y recomendaciones sobre los profesores de tu instituto?'
  },
  center: {
    title: '¡Institución registrada! 🏛️',
    description: '¿Deseas recibir alertas en tiempo real sobre nuevas confesiones y movimientos en tu campus?'
  }
};

/**
 * Dispara el aviso contextual de permisos de notificación tras la primera acción del usuario
 */
export function promptNotificationOnAction(actionType: ActionType) {
  if (typeof window === 'undefined') return;

  // 1. Si el navegador no soporta notificaciones, salir
  if (!('Notification' in window)) return;

  // 2. Si el usuario ya dio permiso o ya denegó explícitamente en el navegador, salir
  if (Notification.permission !== 'default') return;

  // 3. Si el usuario ya descartó el modal contextual en esta sesión/dispositivo, evitar spam
  const hasDismissed = localStorage.getItem('starryz_notif_prompt_dismissed');
  if (hasDismissed === 'true') return;

  const info = ACTION_MESSAGES[actionType] || {
    title: '¡Acción realizada con éxito! 🔔',
    description: '¿Deseas activar las notificaciones en tiempo real para no perderte ninguna novedad de tu instituto?'
  };

  // Disparar evento personalizado para mostrar el modal de notificación
  window.dispatchEvent(
    new CustomEvent<NotificationPromptEventDetail>('starryz_show_notification_prompt', {
      detail: {
        actionType,
        title: info.title,
        description: info.description
      }
    })
  );
}

/**
 * Emite una notificación interna en tiempo real capturada desde FCM (onMessage)
 */
export function dispatchFCMNotificationEvent(payload: {
  id?: string;
  title: string;
  body: string;
  linkUrl?: string;
  data?: Record<string, any>;
  created_at?: string;
}) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent('starryz_fcm_notification', {
      detail: {
        id: payload.id || `fcm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: payload.title,
        body: payload.body,
        linkUrl: payload.linkUrl,
        data: payload.data || {},
        created_at: payload.created_at || new Date().toISOString()
      }
    })
  );
}
