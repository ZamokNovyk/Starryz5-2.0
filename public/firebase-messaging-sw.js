importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker instalándose...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activado y reclamando clientes.');
  event.waitUntil(self.clients.claim());
});

firebase.initializeApp({
  apiKey: "AIzaSyAPTCYvXj0t_tT8pFL3T0au4lnGWFjvBAQ",
  authDomain: "starryz5-usuarios.firebaseapp.com",
  projectId: "starryz5-usuarios",
  storageBucket: "starryz5-usuarios.firebasestorage.app",
  messagingSenderId: "1048861626265",
  appId: "1:1048861626265:web:406d52cf245be964368d08"
});

const messaging = firebase.messaging();

// Manejo de mensajes en segundo plano cuando la app o pestaña está cerrada / en background
messaging.onBackgroundMessage((payload) => {
  console.log('[SW FCM] Mensaje recibido en segundo plano:', payload);

  const title = payload.notification?.title || payload.data?.title || 'Starryz 5';
  const body = payload.notification?.body || payload.data?.body || 'Tienes una nueva interacción en Starryz 5';
  const targetUrl = payload.fcmOptions?.link || payload.data?.link_url || payload.data?.url || '/';
  const icon = payload.notification?.icon || payload.data?.icon || '/Logo/logo.jpg';

  const options = {
    body: body,
    icon: icon,
    badge: '/Logo/favicon.jpg',
    vibrate: [200, 100, 200],
    tag: payload.data?.confession_id ? `confession-${payload.data.confession_id}` : 'starryz-push',
    renotify: true,
    data: {
      url: targetUrl,
      link_url: targetUrl,
      ...payload.data
    },
    actions: [
      {
        action: 'open_url',
        title: 'Ver en Starryz 5'
      }
    ]
  };

  return self.registration.showNotification(title, options);
});

// Respaldo para eventos Push genéricos
self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('[SW Push Event] Raw push data capturado:', data);
    } catch (e) {
      console.log('[SW Push Event] Mensaje de texto push plano:', event.data.text());
    }
  }
});

// Listener para clics sobre la notificación del sistema
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || event.notification.data?.link_url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una pestaña abierta de la aplicación, enfocarla y navegar
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return;
        }
      }
      // Si no hay ninguna pestaña abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
