// Service Worker Unificado - PWA + Firebase Messaging
const CACHE_NAME = 'oracoes-v1.0.0';
const CACHE_ASSETS = [
  '/',
  '/index.html',
  '/oracoes.html',
  '/novena.html',
  '/testemunhos.html',
  '/contato.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.png'
];

// ==========================================
// INSTALAÇÃO - Cache dos Assets
// ==========================================
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cache aberto, adicionando assets...');
        return cache.addAll(CACHE_ASSETS);
      })
      .then(() => {
        console.log('[SW] ✅ Assets em cache');
        return self.skipWaiting(); // Ativar imediatamente
      })
      .catch(err => {
        console.error('[SW] ❌ Erro ao fazer cache:', err);
      })
  );
});

// ==========================================
// ATIVAÇÃO - Limpeza de Caches Antigos
// ==========================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (cache !== CACHE_NAME) {
              console.log('[SW] Removendo cache antigo:', cache);
              return caches.delete(cache);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] ✅ Service Worker ativado');
        return self.clients.claim(); // Assumir controle imediatamente
      })
  );
});

// ==========================================
// FETCH - Estratégia Network First
// ==========================================
self.addEventListener('fetch', (event) => {
  // Ignorar requisições não-GET
  if (event.request.method !== 'GET') return;
  
  // Ignorar requisições externas (Firebase, Analytics, etc)
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Se a resposta for válida, clonar e cachear
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Se offline, tentar buscar do cache
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              console.log('[SW] Servindo do cache:', event.request.url);
              return cachedResponse;
            }
            
            // Se não houver no cache, retornar página offline
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// ==========================================
// FIREBASE CLOUD MESSAGING
// ==========================================
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Configuração do Firebase
firebase.initializeApp({
  apiKey: "AIzaSyCPW3KiSuOR1ZNr_xPj0-CQL2LRcImjV3E",
  authDomain: "pwa-oracoes.firebaseapp.com",
  projectId: "pwa-oracoes",
  storageBucket: "pwa-oracoes.firebasestorage.app",
  messagingSenderId: "729009444214",
  appId: "1:729009444214:web:c2eb3ccaf9612f90375657"
});

const messaging = firebase.messaging();

// ==========================================
// NOTIFICAÇÕES EM BACKGROUND
// ==========================================
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] 📩 Mensagem recebida em background:', payload);
  
  const notificationTitle = payload.notification?.title || 'Orações Católicas';
  const notificationOptions = {
    body: payload.notification?.body || 'Nova mensagem disponível',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'oracao-notification',
    requireInteraction: false,
    data: {
      url: payload.data?.url || '/',
      timestamp: Date.now()
    }
  };
  
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ==========================================
// CLIQUE NA NOTIFICAÇÃO
// ==========================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 👆 Notificação clicada');
  
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Procurar por uma janela já aberta
        for (let client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Se não houver janela aberta, abrir nova
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// ==========================================
// MENSAGENS DO CLIENTE
// ==========================================
self.addEventListener('message', (event) => {
  console.log('[SW] 💬 Mensagem recebida do cliente:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] ✅ Service Worker carregado e pronto!');
