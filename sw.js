const CACHE_NAME = 'btec-frota-cache-v3';

// Lista de arquivos que serão guardados no celular para o app abrir sem internet
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './images.png' // Certifique-se de que a logo está na mesma pasta com este nome exato
];

// 🛠️ 1. INSTALAÇÃO: Cria o cache e guarda todos os arquivos estruturais
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('BTEC SW: Armazenando arquivos estruturais em cache...');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting()) // Força o novo Service Worker a ativar imediatamente
  );
});

// 🔄 2. ATIVAÇÃO: Limpa caches antigos de versões anteriores para não dar conflito de layout
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('BTEC SW: Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()) // Assume o controle do app imediatamente
  );
});

// 📡 3. BUSCA (FETCH): Intercepta as requisições para fazer o app funcionar Offline-First
self.addEventListener('fetch', (e) => {
  // Ignora requisições vindas do Google Apps Script (as postagens de dados não devem ir para o cache)
  if (e.request.url.includes('script.google.com')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      // Se o arquivo estiver no cache do celular, carrega instantaneamente (mesmo offline)
      if (cachedResponse) {
        return cachedResponse;
      }

      // Se não estiver no cache, busca na internet normalmente
      return fetch(e.request).catch(() => {
        // Se a busca falhar e o usuário tentar acessar a página inicial, força o index.html do cache
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
