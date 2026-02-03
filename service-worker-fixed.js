// Service Worker Corrigido - Ativação Imediata
const CACHE_NAME = 'oracoes-v1.0.1';
const CACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// ==========================================
// INSTALAÇÃO - Cache e ATIVAÇÃO IMEDIATA
// ==========================================
self.addEventListener('install', (event) => {
  console.log('[SW] 📦 Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] 💾 Fazendo cache dos assets...');
        return cache.addAll(CACHE_ASSETS);
      })
      .then(() => {
        console.log('[SW] ✅ Assets em cache');
        // CRÍTICO: Ativar imediatamente sem esperar
        return self.skipWaiting();
      })
      .catch(err => {
        console.error('[SW] ❌ Erro ao fazer cache:', err);
      })
  );
});

// ==========================================
// ATIVAÇÃO - Assumir Controle IMEDIATAMENTE
// ==========================================
self.addEventListener('activate', (event) => {
  console.log('[SW] 🔄 Ativando Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cache => {
            if (cache !== CACHE_NAME) {
              console.log('[SW] 🗑️ Removendo cache antigo:', cache);
              return caches.delete(cache);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] ✅ Service Worker ativado!');
        // CRÍTICO: Assumir controle imediatamente
        return self.clients.claim();
      })
      .then(() => {
        console.log('[SW] 👑 Service Worker assumiu controle da página');
        
        // Notificar todos os clientes que SW está ativo
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_ACTIVATED',
              message: 'Service Worker está ativo e pronto!'
            });
          });
        });
      })
  );
});

// ==========================================
// FETCH - Estratégia Cache First para Performance
// ==========================================
self.addEventListener('fetch', (event) => {
  // Ignorar requisições não-GET
  if (event.request.method !== 'GET') return;
  
  // Ignorar requisições externas
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Retornar do cache e atualizar em background
          console.log('[SW] 📦 Servindo do cache:', event.request.url);
          
          // Atualizar cache em background
          fetch(event.request)
            .then(response => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, response.clone());
                });
              }
            })
            .catch(() => {}); // Ignorar erros de atualização
          
          return cachedResponse;
        }
        
        // Se não houver no cache, buscar da rede
        return fetch(event.request)
          .then(response => {
            // Cachear a resposta para próxima vez
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Se offline e não houver no cache, retornar página offline
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// ==========================================
// MENSAGENS DO CLIENTE
// ==========================================
self.addEventListener('message', (event) => {
  console.log('[SW] 💬 Mensagem recebida:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_STATUS') {
    event.ports[0].postMessage({
      active: true,
      ready: true
    });
  }
});

// ==========================================
// FIREBASE CLOUD MESSAGING (Opcional)
// ==========================================
try {
  importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

  firebase.initializeApp({
    apiKey: "AIzaSyCPW3KiSuOR1ZNr_xPj0-CQL2LRcImjV3E",
    authDomain: "pwa-oracoes.firebaseapp.com",
    projectId: "pwa-oracoes",
    storageBucket: "pwa-oracoes.firebasestorage.app",
    messagingSenderId: "729009444214",
    appId: "1:729009444214:web:c2eb3ccaf9612f90375657"
  });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] 📩 Notificação recebida:', payload);
    
    const notificationTitle = payload.notification?.title || 'Orações Católicas';
    const notificationOptions = {
      body: payload.notification?.body || 'Nova mensagem',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'oracao-notification'
    };
    
    return self.registration.showNotification(notificationTitle, notificationOptions);
  });

  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
      clients.openWindow(event.notification.data?.url || '/')
    );
  });
  
  console.log('[SW] 🔥 Firebase Messaging configurado');
} catch (error) {
  console.log('[SW] ℹ️ Firebase Messaging não disponível (opcional)');
}

console.log('[SW] ✅ Service Worker carregado completamente!');
