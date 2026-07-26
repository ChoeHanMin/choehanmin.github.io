// 이 파일은 index.html 에서 <script src> 로 불러옵니다.
// type="module" 이 아닌 클래식 스크립트여야 합니다.
// (전역 스코프를 공유하므로 config.js → app.js 순서가 중요합니다.)

// ▼▼▼ Firebase 설정 (firebase.google.com 무료 프로젝트 생성 후 본인 값으로 교체) ▼▼▼
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCetF-_n3hpC3n4QEolEjbRI05kNpJF5_Y",
    authDomain: "hanmin-request.firebaseapp.com",
    projectId: "hanmin-request",
    storageBucket: "hanmin-request.firebasestorage.app",
    messagingSenderId: "846552471829",
    appId: "1:846552471829:web:49dc2c3613a1ba4b73311c"
  };
  // ⚠ 관리자 비밀번호 / 서비스 코드 상수는 삭제되었습니다.
  //   · 관리자 권한 → Firebase Auth custom claim (admin: true)
  //   · 초대 코드 검증 → Cloud Functions (completeSignup)
  //   클라이언트에 남은 FIREBASE_CONFIG 값은 원래 공개되는 값이라 안전합니다.
  //   실제 보안은 firestore.rules 와 Functions 가 담당합니다.
  const FCM_VAPID_KEY = "YOUR_VAPID_KEY";   // Firebase 콘솔 > 프로젝트 설정 > 클라우드 메시징 > 웹 푸시 인증서
  const FUNCTIONS_REGION = "asia-northeast3";
  // ▲▲▲ 여기까지 ▲▲▲

  let db = null;
  let auth = null;
  let fns = null;
  let firebaseReady = false;
  try{
    if(FIREBASE_CONFIG.apiKey !== "YOUR_FIREBASE_API_KEY"){
      firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
      auth = firebase.auth();
      fns = firebase.app().functions(FUNCTIONS_REGION);
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(()=>{});
      firebaseReady = true;
    }
  }catch(err){
    console.warn("Firebase 초기화 실패:", err);
  }

  function callFn(name, payload){
    if(!fns) return Promise.reject(new Error("Firebase 미설정"));
    return fns.httpsCallable(name)(payload || {}).then(r => r.data);
  }

  // 서비스워커는 오프라인 캐싱 + 푸시 알림을 함께 담당합니다.
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./firebase-messaging-sw.js')
        .then(reg => {
          // 새 버전이 준비되면 다음 방문 때 자동 적용
          reg.addEventListener('updatefound', () => {
            const sw = reg.installing;
            if(!sw) return;
            sw.addEventListener('statechange', () => {
              if(sw.state === 'installed' && navigator.serviceWorker.controller){
                console.info("새 버전이 준비됐어요. 다음에 열 때 적용됩니다.");
              }
            });
          });
        })
        .catch(err => console.warn("서비스워커 등록 실패(무시됨):", err));
    });
  }
