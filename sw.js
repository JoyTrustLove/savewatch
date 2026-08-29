/* SAVE WATCH — 오프라인 부품 (service worker)
   ─────────────────────────────────────────────────────────
   하는 일은 하나뿐이다: 앱 화면 파일을 기기에 넣어 두고,
   인터넷이 없을 때 그것을 대신 내준다.

   ⚠️ 기도 기록(localStorage)은 여기서 건드리지 않는다.
      이 파일이 다루는 것은 "화면"이지 "기록"이 아니다.

   갱신 규칙 = 네트워크 우선(network-first).
   흔한 함정은 캐시 우선으로 짜서 옛 버전이 눌러앉는 것이다.
   그래서 온라인이면 항상 새로 받아오고, 캐시는 못 받았을 때만 쓴다.
   ⚠️ "네트워크 우선"이라고 써 두는 것만으로는 부족하다 — 브라우저 HTTP
      캐시를 건너뛰지 않으면 옛 파일이 네트워크 응답인 척 돌아온다.
   대신 3초를 기다려도 응답이 없으면 기다리지 않고 캐시를 내준다
   — 느린 신호 아래서 앱이 안 열리는 편이 더 나쁘다.                */

var CACHE  = 'savewatch-v6';        /* 화면 구조가 바뀌면 숫자를 올린다 */
var ASSETS = ['./', './index.html'];
var NET_TIMEOUT = 3000;

self.addEventListener('install', function (e) {
  self.skipWaiting();                                   /* 새 판을 즉시 대기시킨다 */
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {        /* 옛 캐시는 지운다 */
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (e.request.url.indexOf('http') !== 0) return;

  e.respondWith(
    Promise.race([
      /* ⚠️ 그냥 fetch(e.request)를 쓰면 브라우저 HTTP 캐시를 탄다.
         GitHub Pages가 max-age=600을 주므로 network-first인데도
         10분 동안 옛 파일이 "새로 받은 것처럼" 돌아온다(2026-08-29 실측).
         cache:'reload'로 원본을 받되, 받은 것은 아래에서 캐시에 넣는다. */
      fetch(new Request(e.request.url, { cache: 'reload' })).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }),
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error('느린 신호')); }, NET_TIMEOUT);
      })
    ]).catch(function () {
      return caches.match(e.request).then(function (hit) {
        return hit || caches.match('./index.html') || caches.match('./');
      });
    })
  );
});
