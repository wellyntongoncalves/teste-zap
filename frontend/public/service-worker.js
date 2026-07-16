// Subir a versão a cada mudança no app shell (ícones, manifest): o activate
// apaga os caches de nome diferente, então é isso que faz quem já instalou
// receber os arquivos novos em vez de continuar com os antigos.
const CACHE_NAME = 'meubolso-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Chamadas de API sempre vão direto pra rede; não faz sentido servir dados financeiros do cache.
  if (request.url.includes('/api/')) {
    return;
  }

  // Navegação (HTML) usa network-first: garante que o app shell mais recente
  // (com os hashes de JS/CSS atualizados) seja buscado sempre que houver rede,
  // só cai pro cache quando offline. Assets com hash no nome (JS/CSS) continuam
  // cache-first logo abaixo, já que uma mudança de conteúdo sempre muda a URL.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request)
          .then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
          .catch(() => caches.match('/index.html'))
      );
    })
  );
});
