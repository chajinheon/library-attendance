// ────────────────────────────────────────────────────────────────
// 효명고 야간자율학습 출결 - Service Worker (Kiosk Security Layer)
// 역할: 외부 URL 네비게이션 차단 + 앱 에셋 캐싱
// ────────────────────────────────────────────────────────────────

const CACHE_NAME = 'hyomyung-kiosk-v1';

// ── 허용된 외부 도메인 (Firebase + Google Fonts) ──
const ALLOWED_HOSTS = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'fcmregistrations.googleapis.com',
  'firebasestorage.googleapis.com',
];

// ── 설치: 즉시 활성화 ──
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ── 활성화: 모든 클라이언트 즉시 제어 ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      // 구버전 캐시 정리
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
    ])
  );
});

// ── Fetch 인터셉터: 외부 URL 차단 + 민감 경로 캐싱 제외 ──
self.addEventListener('fetch', (event) => {
  const { request } = event;
  let url;

  try {
    url = new URL(request.url);
  } catch {
    // 잘못된 URL은 무시
    return;
  }

  const appOrigin = self.location.origin;

  // 1. 민감 경로(/admin, /api)는 캐시 없이 항상 네트워크 직접 요청
  if (url.origin === appOrigin && (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api'))) {
    event.respondWith(fetch(request));
    return;
  }

  // 2. 동일 출처(same-origin) 요청은 허용
  if (url.origin === appOrigin) return;

  // 2. 허용된 외부 도메인 확인
  const isAllowed = ALLOWED_HOSTS.some(
    (host) => url.hostname === host || url.hostname.endsWith('.' + host)
  );
  if (isAllowed) return;

  // 3. 외부 navigate 요청 → 차단 페이지 반환
  if (request.mode === 'navigate') {
    event.respondWith(
      new Response(
        `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>접근 차단</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #F8FAFC;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      text-align: center;
      padding: 3rem 2rem;
      background: white;
      border-radius: 1.5rem;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      max-width: 360px;
      width: 90%;
    }
    .icon { font-size: 3.5rem; margin-bottom: 1.25rem; }
    h1 { font-size: 1.4rem; font-weight: 900; color: #1e293b; margin-bottom: 0.75rem; }
    p { font-size: 0.95rem; color: #64748b; line-height: 1.6; margin-bottom: 1.5rem; }
    a {
      display: inline-block;
      background: #2672D9;
      color: white;
      font-weight: 700;
      padding: 0.75rem 2rem;
      border-radius: 0.75rem;
      text-decoration: none;
      font-size: 0.95rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🔒</div>
    <h1>접근이 차단되었습니다</h1>
    <p>이 기기는 효명고등학교<br>야간자율학습 출결 전용입니다.</p>
    <a href="/">출결 시스템으로 돌아가기</a>
  </div>
</body>
</html>`,
        {
          status: 403,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }
      )
    );
    return;
  }

  // 4. 기타 외부 fetch 요청 차단 (XHR, fetch API 등)
  event.respondWith(
    new Response(JSON.stringify({ error: 'Blocked by security policy' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  );
});
