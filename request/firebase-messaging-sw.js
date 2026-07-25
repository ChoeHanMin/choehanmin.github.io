// 이 파일은 request 폴더 안, index.html과 같은 위치에 올려야 합니다.
// 아래 firebaseConfig 값은 index.html 안에 있는 FIREBASE_CONFIG 값과 동일하게 맞춰주세요.

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
    icon: "./icon-192.png"
  };
  self.registration.showNotification(title, options);
});
