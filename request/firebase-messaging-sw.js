// 이 파일은 request 폴더 안, index.html과 같은 위치에 올려야 합니다.
// 아래 firebaseConfig 값은 index.html 안에 있는 FIREBASE_CONFIG 값과 동일하게 맞춰주세요.
//
// 한 스코프에는 서비스워커가 하나만 등록되므로,
// 푸시 알림(FCM)과 오프라인 캐싱을 이 파일에서 함께 처리합니다.

// ══════════════════════════════════════════════════════════════
//  1. 오프라인 캐싱 (앱 셸)
// ══════════════════════════════════════════════════════════════

// ⚠️ index.html 을 수정할 때마다 이 버전을 올려야 사용자에게 새 버전이 전달됩니다.
const CACHE_VERSION = "v1";
const CACHE_NAME = "hanmin-request-" + CACHE_VERSION;

const APP_SHELL = [
  "./",
  "./index.html",
  "./privacy.html",
  "./styles.css",
  "./config.js",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("[sw] 프리캐시 실패:", err))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith("hanmin-request-") && k !== CACHE_NAME)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // 다른 출처(Firebase API, CDN, EmailJS 등)는 캐시하지 않습니다.
  // 인증 토큰이나 개인 데이터가 캐시에 남지 않도록 하기 위함입니다.
  if (url.origin !== self.location.origin) return;

  // 로그인 링크 파라미터가 붙은 요청은 절대 캐시하지 않습니다.
  if (url.search.includes("oobCode") || url.search.includes("apiKey")) return;

  // HTML 문서: 네트워크 우선 → 실패 시 캐시 (항상 최신 유지)
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // 정적 자산: 캐시 우선 → 없으면 네트워크
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    }).catch(() => undefined)
  );
});


// ══════════════════════════════════════════════════════════════
//  2. 푸시 알림 (FCM)
// ══════════════════════════════════════════════════════════════

importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCetF-_n3hpC3n4QEolEjbRI05kNpJF5_Y",
  authDomain: "hanmin-request.firebaseapp.com",
  projectId: "hanmin-request",
  storageBucket: "hanmin-request.firebasestorage.app",
  messagingSenderId: "846552471829",
  appId: "1:846552471829:web:49dc2c3613a1ba4b73311c"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || "최한민에게 요청하기";
  const options = {
    body: (payload.notification && payload.notification.body) || "",
    icon: "./icon-192.png",
    badge: "./icon-192.png",
    tag: "hanmin-request",
    data: { url: "./" }
  };
  self.registration.showNotification(title, options);
});

// 알림을 누르면 이미 열려 있는 탭으로 이동, 없으면 새로 열기
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL("./", self.location.href).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.startsWith(target) && "focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});
