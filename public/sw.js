/**
 * Phase 9D: Service Worker(SPEC §10)
 *
 * 策略:
 * - 安装:预缓存 app shell(index.html, manifest, icons, offline.html)
 * - 激活:清理旧 cache
 * - fetch:
 *   - navigation 请求 → 网络优先,失败回退到 offline.html
 *   - 静态资源(js/css/svg/png)→ cache-first
 *   - 其他 → network-first,失败回退 cache
 *
 * 不缓存:
 * - 任何 POST / PUT / DELETE 请求
 * - localStorage 数据(不归 SW 管)
 *
 * 安全:
 * - 不缓存任何密钥、token、用户凭证
 * - HTTPS only(浏览器强制)
 */

const CACHE_VERSION = 'v0.9.0-rc1';
const CACHE_NAME = `darkest-dungeon-${CACHE_VERSION}`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/offline.html',
  '/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // app shell 预缓存(忽略失败,部分资源可能还没部署)
      return Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(url).catch((e) => {
            console.warn('[SW] failed to pre-cache', url, e);
          })
        )
      );
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 只处理 GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // 只处理同源
  if (url.origin !== self.location.origin) return;

  // navigation 请求 → network-first,失败 offline.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 成功:写入 cache
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            return cached || caches.match('/offline.html');
          });
        })
    );
    return;
  }

  // 静态资源 → cache-first
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'manifest'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => {
          // 图片缺失:返回占位
          if (request.destination === 'image') {
            return new Response('', { status: 404, statusText: 'offline' });
          }
          return new Response('', { status: 503, statusText: 'offline' });
        });
      })
    );
    return;
  }

  // 其他 → network-first,失败回退 cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
