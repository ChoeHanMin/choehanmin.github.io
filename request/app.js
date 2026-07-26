// 이 파일은 index.html 에서 <script src> 로 불러옵니다.
// type="module" 이 아닌 클래식 스크립트여야 합니다.
// (전역 스코프를 공유하므로 config.js → app.js 순서가 중요합니다.)

// ✅ EmailJS 키는 전부 Cloud Functions 로 이동했습니다.
  //    메일 발송은 Firestore 트리거(onAppointmentCreated / onInquiryCreated)가
  //    서버에서 처리하므로 브라우저에 키가 남지 않습니다.
  // 신청자 본인에게 보내는 확인 메일용 템플릿(선택사항). 아직 안 만들었으면 그대로 둬도
  // 무방하며, 이 경우 확인 메일만 조용히 생략되고 나머지 기능은 정상 작동합니다.
  const EMAILJS_CONFIRM_TEMPLATE_ID = "";   // 서버로 이관 → 빈 값이면 클라이언트 발송은 자동 생략됩니다
  // ▲▲▲ 여기까지 ▲▲▲

  const ALLOWED_EMAIL_DOMAINS = ["gmail.com", "naver.com", "kakao.com"];
  const SEND_COOLDOWN_MS = 60000;

  function getSeoulMinutes(){
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul', hour12: false, hour: '2-digit', minute: '2-digit'
    }).formatToParts(new Date());
    const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
    const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
    return hour * 60 + minute;
  }

  let statusOverride = null;

  function getCurrentStatus(){
    if(statusOverride && statusOverride.status){
      if(!statusOverride.until || new Date(statusOverride.until).getTime() > Date.now()){
        return statusOverride.status;
      }
    }
    const m = getSeoulMinutes();
    if(m >= 390 && m < 1200) return 'study';      // 06:30 ~ 20:00
    if(m >= 1200 && m < 1320) return 'exercise';  // 20:00 ~ 22:00
    if(m >= 1320 || m < 120) return 'play';       // 22:00 ~ 02:00
    return 'sleep';                                // 02:00 ~ 06:30
  }

  function watchStatusOverride(){
    if(!firebaseReady) return;
    db.collection('settings').doc('statusOverride').onSnapshot(doc => {
      statusOverride = doc.exists ? doc.data() : null;
      updateStatusGrid();
    }, err => console.warn("상태 오버라이드 감시 실패:", err));
  }

  function updateStatusGrid(){
    const current = getCurrentStatus();
    document.querySelectorAll('.status-cell').forEach(cell => {
      cell.classList.toggle('active', cell.dataset.status === current);
    });
  }

  function getThemeOverride(){
    try{
      return localStorage.getItem('themeOverride') || 'auto';
    }catch(e){
      return 'auto';
    }
  }

  function setThemeOverride(val){
    try{
      localStorage.setItem('themeOverride', val);
    }catch(e){ /* ignore */ }
  }

  function cycleThemeOverride(){
    const order = ['auto', 'light', 'dark'];
    const current = getThemeOverride();
    const next = order[(order.indexOf(current) + 1) % order.length];
    setThemeOverride(next);
    updateTimeBasedUI();
  }

  function updateThemeToggleLabel(){
    const btn = document.getElementById('themeToggle');
    if(!btn) return;
    const override = getThemeOverride();
    const labels = { auto: '🌗 자동', light: '☀️ 라이트', dark: '🌙 다크' };
    btn.textContent = labels[override];
  }

  function updateSkyIcon(){
    const override = getThemeOverride();
    let isDay;
    if(override === 'light') isDay = true;
    else if(override === 'dark') isDay = false;
    else{
      const m = getSeoulMinutes();
      isDay = m >= 360 && m < 1080; // 06:00 ~ 18:00
    }
    const sun = document.getElementById('sunIcon');
    const moon = document.getElementById('moonIcon');
    const stars = document.getElementById('starsGroup');
    const fireflies = document.getElementById('firefliesGroup');
    const haze = document.getElementById('hazeGroup');
    const sweat = document.getElementById('otterSweat');
    const petals = document.getElementById('petalsGroup');
    if(sun) sun.style.display = isDay ? 'block' : 'none';
    if(moon) moon.style.display = isDay ? 'none' : 'block';
    if(stars) stars.style.display = isDay ? 'none' : 'block';
    if(fireflies) fireflies.style.display = isDay ? 'none' : 'block';
    if(haze) haze.style.display = isDay ? 'block' : 'none';
    if(sweat) sweat.style.display = isDay ? 'block' : 'none';
    if(petals) petals.style.display = isDay ? 'block' : 'none';

    const snow = document.getElementById('snowGroup');
    const month = new Date().getMonth() + 1; // Seoul-ish approximation using local clock
    const isWinter = (month === 12 || month === 1 || month === 2);
    if(snow) snow.style.display = isWinter ? 'block' : 'none';

    document.documentElement.classList.toggle('dark-mode', !isDay);
    updateThemeToggleLabel();
  }

  function updateTimeBasedUI(){
    updateStatusGrid();
    updateSkyIcon();
  }

  updateTimeBasedUI();
  setInterval(updateTimeBasedUI, 60000);
  watchStatusOverride();

  // ── 실시간 날씨 아이콘 (open-meteo, API 키 불필요) ──
  async function updateWeatherIcon(){
    try{
      const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current_weather=true&timezone=Asia%2FSeoul");
      const data = await res.json();
      const code = data.current_weather.weathercode;
      const cloud = document.getElementById('weatherCloud');
      const rain = document.getElementById('weatherRain');
      const snow = document.getElementById('weatherSnow');
      [cloud, rain, snow].forEach(el => { if(el) el.style.display = 'none'; });

      if([51,53,55,61,63,65,80,81,82,95,96,99].includes(code)){
        if(rain) rain.style.display = 'block';
      }else if([71,73,75,77,85,86].includes(code)){
        if(snow) snow.style.display = 'block';
      }else if([1,2,3,45,48].includes(code)){
        if(cloud) cloud.style.display = 'block';
      }
      // code 0(맑음)일 땐 태양/달만 보이도록 아무 아이콘도 띄우지 않음
    }catch(err){
      console.warn("날씨 정보를 가져오지 못했습니다:", err);
    }
  }
  updateWeatherIcon();
  setInterval(updateWeatherIcon, 15 * 60000);

  // ── 방문자 수 카운터 (Firestore counters/visitors, 하루 1회 집계) ──
  async function updateVisitorCount(){
    const el = document.getElementById('visitorCount');
    if(!el) return;
    if(!firebaseReady){ el.textContent = ""; return; }
    try{
      const ref = db.collection('counters').doc('visitors');
      // 같은 브라우저에서 하루 1회만 카운트
      const today = new Date().toISOString().slice(0, 10);
      if(localStorage.getItem('visitCounted') !== today){
        await ref.set({ count: firebase.firestore.FieldValue.increment(1) }, { merge: true });
        localStorage.setItem('visitCounted', today);
      }
      const snap = await ref.get();
      const n = (snap.exists && snap.data().count) || 0;
      el.textContent = "👀 " + n.toLocaleString() + "명 다녀감";
    }catch(err){
      el.textContent = "";
    }
  }
  // updateVisitorCount() 는 로그인 완료 후 enterApp() 에서 호출합니다.

  // ── 치와와 기분 랜덤 전환 (혀 내밀기 / 화내기 / 간식 먹기) ──
  function cycleDogMood(){
    const moods = ['default', 'default', 'angry', 'eating'];
    const current = moods[Math.floor(Math.random() * moods.length)];
    const faceDefault = document.getElementById('dogFaceDefault');
    const faceAngry = document.getElementById('dogFaceAngry');
    const snack = document.getElementById('dogSnack');
    if(!faceDefault || !faceAngry || !snack) return;
    faceDefault.style.display = current === 'default' ? 'block' : 'none';
    faceAngry.style.display = current === 'angry' ? 'block' : 'none';
    snack.style.display = current === 'eating' ? 'block' : 'none';
    snack.classList.toggle('chewing', current === 'eating');
  }
  cycleDogMood();
  setInterval(cycleDogMood, 4500);

  // ── 메리 / 찰스 기분 랜덤 전환 (잠자기 / 해바라기씨 먹기 / 쳇바퀴 돌리기) ──
  function cycleHamsterMood(prefix){
    const moods = ['awake', 'sleep', 'eating', 'wheel'];
    const current = moods[Math.floor(Math.random() * moods.length)];
    const awake = document.getElementById(prefix + 'FaceAwake');
    const sleep = document.getElementById(prefix + 'FaceSleep');
    const snack = document.getElementById(prefix + 'Snack');
    const wheel = document.getElementById(prefix + 'Wheel');
    if(!awake || !sleep || !snack || !wheel) return;
    awake.style.display = (current === 'awake' || current === 'wheel') ? 'block' : 'none';
    sleep.style.display = current === 'sleep' ? 'block' : 'none';
    snack.style.display = current === 'eating' ? 'block' : 'none';
    wheel.style.display = current === 'wheel' ? 'block' : 'none';
  }
  cycleHamsterMood('mary');
  cycleHamsterMood('charles');
  setInterval(()=>cycleHamsterMood('mary'), 5000);
  setInterval(()=>cycleHamsterMood('charles'), 5500);

  // ── 치와와 앞모습/옆모습 전환 ──
  function cycleDogPose(){
    const front = document.getElementById('dogFront');
    const side = document.getElementById('dogSide');
    if(!front || !side) return;
    const showSide = Math.random() < 0.35;
    front.style.display = showSide ? 'none' : 'block';
    side.style.display = showSide ? 'block' : 'none';
  }
  cycleDogPose();
  setInterval(cycleDogPose, 8000);

  // ── 링크 복사 ──
  function copyPageLink(){
    const url = window.location.href;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(url)
        .then(()=> showToast("링크가 복사되었습니다"))
        .catch(()=> showToast("복사에 실패했어요"));
    }else{
      showToast("복사에 실패했어요");
    }
  }

  // ── 버튼 클릭/성공 사운드 (Web Audio API, 외부 파일 불필요) ──
  let audioCtx = null;
  function getAudioCtx(){
    if(!audioCtx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(AC) audioCtx = new AC();
    }
    return audioCtx;
  }
  function playTone(freq, duration, type, volume){
    const ctx = getAudioCtx();
    if(!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.value = volume || 0.06;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.stop(ctx.currentTime + duration);
  }
  function playClickSound(){
    playTone(720, 0.08, 'sine', 0.05);
  }
  function playSuccessSound(){
    playTone(660, 0.12, 'sine', 0.06);
    setTimeout(()=>playTone(880, 0.16, 'sine', 0.06), 110);
  }

  // ── 수달 이스터에그 ──
  let otterClickCount = 0;
  function clickOtterEasterEgg(){
    otterClickCount++;
    if(otterClickCount === 7){
      playSuccessAnimation();
      showToast("🥚 숨겨진 메시지: 수달을 발견해줘서 고마워요!");
      otterClickCount = 0;
    }else if(otterClickCount % 3 === 0){
      showToast("수달을 " + otterClickCount + "번 만졌어요...");
    }
  }

  // ── 음성으로 문의 입력 ──
  function startVoiceInput(targetId){
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRec){
      showToast("이 브라우저는 음성 입력을 지원하지 않아요");
      return;
    }
    const recognition = new SpeechRec();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    showToast("듣고 있어요... 말씀해주세요");
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      const target = document.getElementById(targetId);
      if(target) target.value += (target.value ? ' ' : '') + text;
    };
    recognition.onerror = () => showToast("음성 인식에 실패했어요");
    recognition.start();
  }

  // ── 약속 신청 완료 후 내 캘린더에 추가(.ics 다운로드) ──
  function toIcsDate(dateObj){
    return dateObj.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
  }
  function downloadIcs(title, isoDatetime){
    const start = new Date(isoDatetime);
    const end = new Date(start.getTime() + 60 * 60000);
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "SUMMARY:" + title,
      "DTSTART:" + toIcsDate(start),
      "DTEND:" + toIcsDate(end),
      "DESCRIPTION:최한민에게 요청하기 페이지를 통해 신청한 약속입니다.",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "약속.ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  function showAddToCalendar(title, isoDatetime){
    const btn = document.createElement('button');
    btn.className = 'calendar-fab';
    btn.textContent = '📅 내 캘린더에 추가';
    btn.onclick = function(){
      downloadIcs(title, isoDatetime);
      btn.remove();
    };
    document.body.appendChild(btn);
    setTimeout(()=>btn.remove(), 12000);
  }

  // ── (선택) 구글 시트에 신청 내역 자동 기록 ──
  // Google Apps Script 웹앱 URL을 만들어서 아래에 넣으면, 문의/약속 신청 내역이
  // 자동으로 구글 시트에 쌓입니다. 설정 안 해도 나머지 기능엔 전혀 지장 없습니다.
  // 시트 기록도 Cloud Functions 로 이동했습니다 (웹훅 URL 노출 방지).
  function logToSheet(){ return; }

  // ── Firestore 백엔드 저장 (관리자 대시보드/채팅/캘린더 충돌 체크의 기반) ──
  async function saveToFirestore(collectionName, data){
    if(!firebaseReady) return null;
    try{
      const ref = await db.collection(collectionName).add(Object.assign({
        status: "대기중",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, data));
      return ref.id;
    }catch(err){
      console.warn("Firestore 저장 실패(무시됨):", err);
      return null;
    }
  }

  // ── 약속 시간 겹침 체크용 '바쁜 시간' 목록 가져오기 ──
  async function fetchBusySlots(){
    if(!firebaseReady) return [];
    try{
      const snap = await db.collection('busySlots').get();
      return snap.docs.map(d => d.data());
    }catch(err){
      console.warn("바쁜 시간 조회 실패(무시됨):", err);
      return [];
    }
  }

  function isOverlappingBusySlot(datetimeValue, busySlots){
    const target = new Date(datetimeValue).getTime();
    const targetEnd = target + 60 * 60000;
    return busySlots.some(slot => {
      const s = new Date(slot.start).getTime();
      const e = new Date(slot.end).getTime();
      return target < e && targetEnd > s;
    });
  }

  // ── 푸시 알림용 FCM 토큰 등록 (실제 발송은 Firebase 콘솔에서 수동으로) ──
  async function registerPushToken(ownerEmail){
    if(!firebaseReady || !firebase.messaging || FCM_VAPID_KEY === "YOUR_VAPID_KEY") return;
    try{
      const messaging = firebase.messaging();
      const permission = await Notification.requestPermission();
      if(permission !== 'granted') return;
      const token = await messaging.getToken({ vapidKey: FCM_VAPID_KEY });
      if(token){
        await db.collection('fcmTokens').doc(ownerEmail).set({
          token: token,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }catch(err){
      console.warn("푸시 토큰 등록 실패(무시됨):", err);
    }
  }

  // ── 회원 ↔ 최한민 채팅 ──
  let chatUnsubscribe = null;
  let chatBadgeUnsubscribe = null;

  function getCurrentMemberEmail(){
    return (auth && auth.currentUser && auth.currentUser.email)
      ? auth.currentUser.email.toLowerCase()
      : null;
  }

  function watchChatBadge(email){
    if(!firebaseReady || !email) return;
    if(chatBadgeUnsubscribe){ chatBadgeUnsubscribe(); }
    chatBadgeUnsubscribe = db.collection('chats').doc(email).onSnapshot(doc => {
      const badge = document.getElementById('chatBadge');
      if(!badge || !doc.exists) return;
      const d = doc.data();
      const lastSeen = localStorage.getItem('chatLastSeen_' + email) || '0';
      const updatedAtMs = d.updatedAt && d.updatedAt.toMillis ? d.updatedAt.toMillis() : 0;
      badge.style.display = (d.lastSender === 'admin' && updatedAtMs > parseInt(lastSeen, 10)) ? 'block' : 'none';
    }, err => console.warn("채팅 알림 감시 실패:", err));
  }

  function openChatPanel(){
    if(!firebaseReady){
      showToast("채팅 기능은 Firebase 설정 후 사용할 수 있어요");
      return;
    }
    const email = getCurrentMemberEmail();
    if(!email){
      showToast("로그인 후 이용할 수 있어요");
      return;
    }
    document.getElementById('chatOverlay').classList.add('show');
    listenToChat(email);
    localStorage.setItem('chatLastSeen_' + email, String(Date.now()));
    const badge = document.getElementById('chatBadge');
    if(badge) badge.style.display = 'none';
  }

  function closeChatPanel(){
    document.getElementById('chatOverlay').classList.remove('show');
    if(chatUnsubscribe){ chatUnsubscribe(); chatUnsubscribe = null; }
    const email = getCurrentMemberEmail();
    if(email) localStorage.setItem('chatLastSeen_' + email, String(Date.now()));
  }

  function listenToChat(email){
    if(chatUnsubscribe){ chatUnsubscribe(); }
    const box = document.getElementById('chatMessages');
    chatUnsubscribe = db.collection('chats').doc(email).collection('messages')
      .orderBy('createdAt', 'asc')
      .onSnapshot(snap => {
        box.innerHTML = snap.docs.map(doc => {
          const m = doc.data();
          const cls = m.sender === 'admin' ? 'theirs' : 'mine';
          return `<div class="chat-bubble ${cls}">${escapeHtml(m.text || '')}</div>`;
        }).join('');
        box.scrollTop = box.scrollHeight;
      }, err => console.warn("채팅 수신 실패:", err));
  }

  // 텍스트 컨텍스트용. 따옴표까지 명시적으로 이스케이프합니다.
  const HTML_ENTITIES = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;', '`': '&#96;', '=': '&#61;', '/': '&#47;'
  };
  function escapeHtml(str){
    return String(str == null ? '' : str).replace(/[&<>"'`=\/]/g, c => HTML_ENTITIES[c]);
  }

  // 속성 컨텍스트용 (onclick="fn('...')" 처럼 JS 문자열 안에 들어가는 값).
  // 따옴표·역슬래시·개행·꺾쇠를 모두 무해화합니다.
  function escapeAttr(str){
    return String(str == null ? '' : str)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\r?\n/g, '');
  }

  async function sendChatMessage(){
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if(!text) return;
    const email = getCurrentMemberEmail();
    if(!email || !firebaseReady) return;
    input.value = '';
    try{
      await db.collection('chats').doc(email).collection('messages').add({
        text: text,
        sender: 'member',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection('chats').doc(email).set({
        email: email,
        lastMessage: text,
        lastSender: 'member',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }catch(err){
      showToast("메시지 전송에 실패했어요");
    }
  }

  // ── 관리자 로그인/대시보드 ──
  let isAdminLoggedIn = false;

  function openAdminLogin(){
    document.getElementById('adminLoginOverlay').classList.add('show');
  }
  function closeAdminLogin(){
    document.getElementById('adminLoginOverlay').classList.remove('show');
  }

  // 관리자 여부는 Firebase Auth custom claim(admin: true)으로만 판정합니다.
  // 클라이언트 코드를 고쳐도 claim이 없으면 Firestore 규칙에서 전부 거부됩니다.
  async function refreshAdminClaim(){
    isAdminLoggedIn = false;
    if(!auth || !auth.currentUser) return false;
    try{
      const res = await auth.currentUser.getIdTokenResult(true);
      isAdminLoggedIn = res.claims && res.claims.admin === true;
    }catch(e){
      isAdminLoggedIn = false;
    }
    const btn = document.getElementById('adminEntryBtn');
    if(btn) btn.style.display = isAdminLoggedIn ? '' : 'none';
    return isAdminLoggedIn;
  }

  async function submitAdminLogin(){
    const hint = document.getElementById('adminLoginHint');
    hint.textContent = "확인 중...";
    const ok = await refreshAdminClaim();
    if(!ok){
      hint.textContent = "이 계정에는 관리자 권한이 없습니다.";
      return;
    }
    hint.textContent = "";
    closeAdminLogin();
    document.getElementById('adminDashboardOverlay').classList.add('show');
    loadAdminDashboard();
  }

  function closeAdminDashboard(){
    document.getElementById('adminDashboardOverlay').classList.remove('show');
  }

  async function setStatusOverride(status){
    if(!firebaseReady) return;
    try{
      await db.collection('settings').doc('statusOverride').set({ status: status, until: null });
      showToast("상태를 고정했어요");
      logAdminAction("상태를 '" + status + "'(으)로 수동 고정");
    }catch(err){
      showToast("설정에 실패했어요");
    }
  }

  async function clearStatusOverride(){
    if(!firebaseReady) return;
    try{
      await db.collection('settings').doc('statusOverride').delete();
      showToast("자동 모드로 돌아갔어요");
      logAdminAction("상태를 자동(시간표) 모드로 복귀");
    }catch(err){
      showToast("설정에 실패했어요");
    }
  }

  function switchAdminTab(btn, panel){
    document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    ['Inquiries', 'Appointments', 'Members', 'Chats', 'Busy', 'Log'].forEach(name => {
      const el = document.getElementById('adminPanel' + name);
      if(el) el.style.display = (name.toLowerCase() === panel) ? 'block' : 'none';
    });
    if(panel === 'log') renderAdminLog();
  }

  let adminCache = { inquiries: [], appointments: [], members: [], chats: [] };

  async function loadAdminDashboard(){
    if(!firebaseReady) return;
    try{
      const [inquirySnap, apptSnap, memberSnap, chatSnap] = await Promise.all([
        db.collection('inquiries').orderBy('createdAt', 'desc').get(),
        db.collection('appointments').orderBy('createdAt', 'desc').get(),
        db.collection('members').orderBy('createdAt', 'desc').get(),
        db.collection('chats').orderBy('updatedAt', 'desc').get()
      ]);

      adminCache.inquiries = inquirySnap.docs.map(doc => Object.assign({ id: doc.id }, doc.data()));
      adminCache.appointments = apptSnap.docs.map(doc => Object.assign({ id: doc.id }, doc.data()));
      adminCache.members = memberSnap.docs.map(doc => Object.assign({ id: doc.id }, doc.data()));
      adminCache.chats = chatSnap.docs.map(doc => Object.assign({ id: doc.id }, doc.data()));

      const responded = [...adminCache.inquiries, ...adminCache.appointments].filter(d => d.respondedAt && d.createdAt);
      let avgLabel = '-';
      if(responded.length){
        const totalMs = responded.reduce((sum, d) => sum + (d.respondedAt.toMillis() - d.createdAt.toMillis()), 0);
        const avgHours = (totalMs / responded.length / 3600000).toFixed(1);
        avgLabel = avgHours + "시간";
      }

      document.getElementById('adminStats').innerHTML = `
        <div class="admin-stat-box"><div class="admin-stat-num">${adminCache.inquiries.length}</div><div class="admin-stat-label">문의</div></div>
        <div class="admin-stat-box"><div class="admin-stat-num">${adminCache.appointments.length}</div><div class="admin-stat-label">약속</div></div>
        <div class="admin-stat-box"><div class="admin-stat-num">${adminCache.members.length}</div><div class="admin-stat-label">회원</div></div>
        <div class="admin-stat-box"><div class="admin-stat-num">${avgLabel}</div><div class="admin-stat-label">평균 응답</div></div>
      `;

      renderAdminLists();
    }catch(err){
      console.warn("관리자 데이터 로드 실패:", err);
      showToast("데이터를 불러오지 못했어요");
    }
  }

  function renderAdminLists(){
    const q = (document.getElementById('adminSearchInput').value || '').trim().toLowerCase();
    const match = (fields) => !q || fields.some(f => (f || '').toLowerCase().includes(q));

    document.getElementById('adminPanelInquiries').innerHTML = adminCache.inquiries
      .filter(d => match([d.title, d.email, d.body]))
      .map(d => `<div class="admin-row">
        <div class="admin-row-title">${escapeHtml(d.title || '(제목 없음)')}</div>
        <div class="admin-row-meta">${escapeHtml(d.email || '')} · ${escapeHtml(d.category || '')} ${d.relation ? '· ' + escapeHtml(d.relation) : ''}</div>
        <div>${escapeHtml(d.body || '')}</div>
        <div style="margin-top:8px;">
          <select class="admin-status-select" onchange="updateDocStatus('inquiries','${escapeAttr(d.id)}',this.value)">
            ${['대기중','수락','거절','완료'].map(s => `<option value="${s}" ${d.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>`).join('') || '<p class="field-hint">해당하는 문의가 없어요.</p>';

    document.getElementById('adminPanelAppointments').innerHTML = adminCache.appointments
      .filter(d => match([d.appointmentType, d.email, d.applicant]))
      .map(d => `<div class="admin-row">
        <div class="admin-row-title">${escapeHtml(d.appointmentType || '')}</div>
        <div class="admin-row-meta">${escapeHtml(d.email || '')} · 신청자: ${escapeHtml(d.applicant || '')} · 동행: ${escapeHtml(d.companion || '')}</div>
        <div>${escapeHtml(d.datetimeDisplay || '')} ${d.games ? '· ' + escapeHtml(d.games) : ''}</div>
        <div style="margin-top:8px;">
          <select class="admin-status-select" onchange="updateDocStatus('appointments','${escapeAttr(d.id)}',this.value)">
            ${['대기중','수락','거절','완료'].map(s => `<option value="${s}" ${d.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>`).join('') || '<p class="field-hint">해당하는 약속이 없어요.</p>';

    document.getElementById('adminPanelMembers').innerHTML = adminCache.members
      .filter(d => match([d.name, d.email]))
      .map(d => `<div class="admin-row">
        <div class="admin-row-title">${escapeHtml(d.name || '')}</div>
        <div class="admin-row-meta">${escapeHtml(d.email || '')}</div>
      </div>`).join('') || '<p class="field-hint">해당하는 회원이 없어요.</p>';

    document.getElementById('adminPanelChats').innerHTML = adminCache.chats
      .filter(d => match([d.email, d.lastMessage]))
      .map(d => `<div class="admin-row" style="cursor:pointer;" onclick="openAdminChatThread('${escapeAttr(d.id)}')">
        <div class="admin-row-title">${escapeHtml(d.email || d.id)}</div>
        <div class="admin-row-meta">${escapeHtml(d.lastMessage || '')}</div>
      </div>`).join('') || '<p class="field-hint">아직 채팅이 없어요.</p>';

    renderBusySlots();
  }

  function exportCsv(){
    const rows = [['종류', '제목/유형', '이메일', '분류', '상태', '내용/신청자']];
    adminCache.inquiries.forEach(d => rows.push(['문의', d.title || '', d.email || '', d.category || '', d.status || '', d.body || '']));
    adminCache.appointments.forEach(d => rows.push(['약속', d.appointmentType || '', d.email || '', d.datetimeDisplay || '', d.status || '', d.applicant || '']));
    const csv = rows.map(r => r.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '신청내역.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function backupToSheet(){
    [...adminCache.inquiries, ...adminCache.appointments].forEach(d => {
      logToSheet({
        type: "백업",
        category: d.category || d.appointmentType || '',
        email: d.email || '',
        title: d.title || d.appointmentType || '',
        body: d.body || d.applicant || '',
        sentAt: new Date().toISOString()
      });
    });
    showToast("백업 요청을 보냈어요 (구글시트 확인)");
  }

  function logAdminAction(action){
    if(!firebaseReady) return;
    db.collection('adminLog').add({
      action: action,
      at: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(()=>{});
  }

  async function renderAdminLog(){
    const box = document.getElementById('adminPanelLog');
    if(!box || !firebaseReady) return;
    try{
      const snap = await db.collection('adminLog').orderBy('at', 'desc').limit(30).get();
      box.innerHTML = snap.docs.map(doc => {
        const d = doc.data();
        const when = d.at ? new Date(d.at.toMillis()).toLocaleString('ko-KR') : '';
        return `<div class="admin-row"><div class="admin-row-meta">${when}</div><div>${escapeHtml(d.action || '')}</div></div>`;
      }).join('') || '<p class="field-hint">아직 활동 기록이 없어요.</p>';
    }catch(err){
      box.innerHTML = '<p class="field-hint">불러오지 못했어요.</p>';
    }
  }

  async function updateDocStatus(collectionName, docId, status){
    if(!firebaseReady) return;
    try{
      let reason = '';
      if(status === '수락' || status === '거절'){
        reason = prompt((status === '수락' ? '수락' : '거절') + " 사유(선택, 비워도 됨)를 입력하세요:") || '';
      }
      const doc = await db.collection(collectionName).doc(docId).get();
      const d = doc.data();
      const updatePayload = { status: status };
      if(status === '수락' || status === '거절' || status === '완료'){
        updatePayload.respondedAt = firebase.firestore.FieldValue.serverTimestamp();
      }
      await db.collection(collectionName).doc(docId).update(updatePayload);
      showToast("상태가 업데이트됐어요");
      logAdminAction((collectionName === 'inquiries' ? '문의' : '약속') + " 상태를 '" + status + "'(으)로 변경");
      loadAdminDashboard();

      if((status === '수락' || status === '거절') && d && d.email){
        const label = collectionName === 'inquiries' ? (d.title || '문의') : (d.appointmentType || '약속');
        sendEmail({
          to_email: d.email,
          title: "[" + status + "] " + label,
          message: (d.applicant || '') + " 님, \"" + label + "\" 건이 " + status + "되었습니다." + (reason ? ("\n사유: " + reason) : "")
        }, EMAILJS_CONFIRM_TEMPLATE_ID).catch(err => console.warn("상태 알림 메일 실패(무시됨):", err));
      }
    }catch(err){
      showToast("업데이트에 실패했어요");
    }
  }

  function openAdminChatThread(email){
    const reply = prompt(email + " 님에게 보낼 답장을 입력하세요:");
    if(!reply) return;
    db.collection('chats').doc(email).collection('messages').add({
      text: reply,
      sender: 'admin',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    db.collection('chats').doc(email).set({
      lastMessage: reply,
      lastSender: 'admin',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    showToast("답장을 보냈어요");
  }

  async function addBusySlot(){
    const start = document.getElementById('busyStart').value;
    const end = document.getElementById('busyEnd').value;
    const label = document.getElementById('busyLabel').value.trim();
    if(!start || !end){
      showToast("시작/종료 시간을 입력해주세요");
      return;
    }
    try{
      await db.collection('busySlots').add({ start, end, label });
      document.getElementById('busyStart').value = '';
      document.getElementById('busyEnd').value = '';
      document.getElementById('busyLabel').value = '';
      renderBusySlots();
    }catch(err){
      showToast("추가에 실패했어요");
    }
  }

  async function renderBusySlots(){
    if(!firebaseReady) return;
    try{
      const snap = await db.collection('busySlots').get();
      document.getElementById('busySlotList').innerHTML = snap.docs.map(doc => {
        const d = doc.data();
        return `<div class="admin-row">
          <div class="admin-row-title">${escapeHtml(d.label || '(메모 없음)')}</div>
          <div class="admin-row-meta">${escapeHtml(d.start)} ~ ${escapeHtml(d.end)}</div>
          <button class="back-link" onclick="deleteBusySlot('${escapeAttr(doc.id)}')">삭제</button>
        </div>`;
      }).join('') || '<p class="field-hint">등록된 바쁜 시간이 없어요.</p>';
    }catch(err){
      console.warn("바쁜 시간 목록 로드 실패:", err);
    }
  }

  async function deleteBusySlot(docId){
    try{
      await db.collection('busySlots').doc(docId).delete();
      renderBusySlots();
    }catch(err){
      showToast("삭제에 실패했어요");
    }
  }

  function isAllowedEmail(email){
    const match = /^[^\s@]+@([^\s@]+)$/.exec(email.trim().toLowerCase());
    if(!match) return false;
    return ALLOWED_EMAIL_DOMAINS.includes(match[1]);
  }

  // 메일 발송은 서버(Cloud Functions)가 Firestore 문서 생성을 감지해 자동 처리합니다.
  // 기존 호출부를 깨뜨리지 않기 위해 빈 함수로 남겨둡니다.
  async function sendEmail(){ return; }

  function pickParticle(word, withBatchim, withoutBatchim){
    if(!word) return withoutBatchim;
    const lastChar = word.trim().slice(-1);
    const code = lastChar.charCodeAt(0);
    if(code < 0xAC00 || code > 0xD7A3) return withoutBatchim;
    const hasBatchim = (code - 0xAC00) % 28 !== 0;
    return hasBatchim ? withBatchim : withoutBatchim;
  }

  async function sendConfirmationEmail(toEmail, title, message){
    if(!EMAILJS_CONFIRM_TEMPLATE_ID || EMAILJS_CONFIRM_TEMPLATE_ID === "YOUR_CONFIRM_TEMPLATE_ID") return;
    try{
      await sendEmail({
        to_email: toEmail,
        title: title,
        message: message
      }, EMAILJS_CONFIRM_TEMPLATE_ID);
    }catch(err){
      console.warn("확인 메일 전송 실패(무시됨):", err);
    }
  }

  function canSendNow(){
    try{
      const last = parseInt(localStorage.getItem('lastSendTime') || '0', 10);
      return (Date.now() - last) >= SEND_COOLDOWN_MS;
    }catch(e){
      return true;
    }
  }

  function recordSendTime(){
    try{
      localStorage.setItem('lastSendTime', String(Date.now()));
    }catch(e){ /* ignore */ }
  }

  const sheetTemplates = {
    extra: `
      <div class="sheet-head">
        <p class="sheet-title">기타 서비스</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <div class="option-list">
        <button class="option-btn" onclick="openSheet('guestbook')">📖 방명록</button>
        <button class="option-btn" onclick="openSheet('rollingPaper')">📝 롤링페이퍼</button>
        <button class="option-btn" onclick="openSheet('vote')">🗳️ 밸런스 게임/투표</button>
        <button class="option-btn" onclick="openSheet('fortune')">🔮 오늘의 운세</button>
        <button class="option-btn" onclick="openSheet('wishlist')">🎁 위시리스트</button>
        <button class="option-btn" onclick="openSheet('interests')">🎵 요즘 관심사</button>
        <button class="option-btn" onclick="openSheet('gameStats')">🎮 게임 전적</button>
        <button class="option-btn" onclick="openSheet('publicSchedule')">📅 공개 스케줄</button>
        <button class="option-btn" onclick="openSheet('activityFeed')">📢 최근 활동</button>
        <button class="option-btn" onclick="openSheet('inviteRanking')">🏆 초대 랭킹</button>
        <button class="option-btn" onclick="openSheet('themeColor')">🎨 테마 컬러</button>
        <button class="option-btn" onclick="openSheet('favorites')">⭐ 즐겨찾기 설정</button>
      </div>
    `,
    favorites: `
      <div class="sheet-head">
        <p class="sheet-title">⭐ 즐겨찾기 설정</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <p class="gate-sub" style="text-align:left;">자주 쓰는 기능을 하나 골라두면, 메인 화면 상단에 바로가기가 생겨요.</p>
      <div class="option-list">
        <button class="option-btn" onclick="setFavorite('appointment','약속 잡기')">약속 잡기</button>
        <button class="option-btn" onclick="setFavorite('inquiry','문의 남기기')">문의 남기기</button>
        <button class="option-btn" onclick="setFavorite('who','최한민은 누구인가요?')">최한민은 누구인가요?</button>
        <button class="back-link" onclick="clearFavorite()">즐겨찾기 해제</button>
      </div>
    `,
    activityFeed: `
      <div class="sheet-head">
        <p class="sheet-title">📢 최근 활동</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <div id="activityFeedList"><p class="field-hint">불러오는 중...</p></div>
    `,
    inviteRanking: `
      <div class="sheet-head">
        <p class="sheet-title">🏆 초대 랭킹</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <div id="inviteRankingList"><p class="field-hint">불러오는 중...</p></div>
    `,
    themeColor: `
      <div class="sheet-head">
        <p class="sheet-title">🎨 테마 컬러</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <p class="gate-sub" style="text-align:left;">포인트 컬러를 골라보세요 (내 브라우저에만 적용돼요).</p>
      <div class="option-list">
        <button class="option-btn" onclick="setThemeColor('#3654FF')">💙 블루 (기본)</button>
        <button class="option-btn" onclick="setThemeColor('#FF6B47')">🧡 오렌지</button>
        <button class="option-btn" onclick="setThemeColor('#2FAE66')">💚 그린</button>
        <button class="option-btn" onclick="setThemeColor('#B84FE0')">💜 퍼플</button>
        <button class="option-btn" onclick="setThemeColor('#E0507A')">💗 핑크</button>
      </div>
    `,
    qrcode: `
      <div class="sheet-head">
        <p class="sheet-title">📱 QR코드</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <div style="text-align:center;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=https://choehanmin.github.io/request/" alt="QR code" style="border-radius:12px;">
        <p class="field-hint field-hint--static" style="margin-top:12px;">폰 카메라로 스캔하면 바로 접속돼요.</p>
      </div>
    `,
    wishlist: `
      <div class="sheet-head">
        <p class="sheet-title">🎁 위시리스트</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <p class="gate-sub" style="text-align:left;">최한민이 받고 싶은 것들이에요 (예시입니다, 업데이트 예정).</p>
      <div class="faq-item"><p class="faq-a">☕ 스타벅스 기프티콘</p></div>
      <div class="faq-item"><p class="faq-a">🎮 스팀 게임 카드</p></div>
      <div class="faq-item"><p class="faq-a">📚 컴퓨터공학 관련 서적</p></div>
    `,
    interests: `
      <div class="sheet-head">
        <p class="sheet-title">🎵 요즘 관심사</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <p class="gate-sub" style="text-align:left;">최한민이 요즘 빠져있는 것들이에요 (예시입니다, 업데이트 예정).</p>
      <div class="faq-item"><p class="faq-a">🎯 오버워치 / 레인보우식스 시즈</p></div>
      <div class="faq-item"><p class="faq-a">🤿 스쿠버 다이빙</p></div>
      <div class="faq-item"><p class="faq-a">⛳ 골프</p></div>
      <div class="faq-item"><p class="faq-a">🐴 승마</p></div>
    `,
    gameStats: `
      <div class="sheet-head">
        <p class="sheet-title">🎮 게임 전적</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <p class="gate-sub" style="text-align:left;">전적 사이트로 바로 이동할 수 있어요.</p>
      <div class="option-list">
        <a class="option-btn" href="https://overwatch.blizzard.com" target="_blank" rel="noopener" style="display:block;text-decoration:none;">오버워치 전적 사이트 열기</a>
        <a class="option-btn" href="https://r6.tracker.network" target="_blank" rel="noopener" style="display:block;text-decoration:none;">레인보우식스 시즈 전적 사이트 열기</a>
      </div>
      <p class="field-hint field-hint--static">본인 계정을 직접 검색해서 확인해보세요.</p>
    `,
    appointment: `
      <div class="sheet-head">
        <p class="sheet-title">약속 잡기</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <div class="option-list">
        <button class="option-btn" onclick="selectAppointmentType('공부/대외활동 등 학습 활동 약속')">공부/대외활동 등 학습 활동 약속</button>
        <button class="option-btn" onclick="selectAppointmentType('운동 약속')">운동 약속</button>
        <button class="option-btn" onclick="selectAppointmentType('식사 약속')">식사 약속</button>
        <button class="option-btn" onclick="selectAppointmentType('게임 약속')">게임 약속</button>
        <button class="option-btn" onclick="selectAppointmentType('데이트 약속')">데이트 약속</button>
      </div>
    `,
    inquiry: `
      <div class="sheet-head">
        <p class="sheet-title">문의 남기기</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <p class="note-blue">카톡/인스타 DM으로 문의하셔도 됩니다.</p>
      <div class="form-group">
        <label class="form-label" for="inquiryEmail">보내는 사람 이메일 (로그인 계정)</label>
        <input class="form-input" id="inquiryEmail" type="email" readonly
               style="background:var(--accent-soft);cursor:not-allowed;">
        <p class="field-hint" id="inquiryEmailHint"></p>
      </div>
      <div class="form-group">
        <label class="form-label">보내는 사람 분류</label>
        <div class="tag-group">
          <button type="button" class="tag-btn" onclick="selectRelation(this,'부모')">부모</button>
          <button type="button" class="tag-btn" onclick="selectRelation(this,'친구')">친구</button>
          <button type="button" class="tag-btn" onclick="selectRelation(this,'지인')">지인</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">제목</label>
        <input class="form-input" id="inquiryTitle" type="text" placeholder="문의 제목을 입력해주세요">
      </div>
      <div class="form-group">
        <label class="form-label">문의 내용</label>
        <textarea class="form-textarea" id="inquiryBody" placeholder="문의하실 내용을 자세히 적어주세요"></textarea>
        <button type="button" class="back-link" onclick="startVoiceInput('inquiryBody')">🎤 음성으로 입력하기</button>
        <p class="field-hint field-hint--static">욕설/비방 시 제재 대상이 됩니다. 누가 메일을 보냈는지 알아낼 수 있습니다.</p>
      </div>
      <div class="form-group">
        <label class="form-label">분류</label>
        <div class="tag-group">
          <button type="button" class="tag-btn" onclick="selectTag(this,'불만')">불만</button>
          <button type="button" class="tag-btn" onclick="selectTag(this,'칭찬')">칭찬</button>
          <button type="button" class="tag-btn" onclick="selectTag(this,'아무 생각 없음')">아무 생각 없음</button>
        </div>
      </div>
      <button class="submit-btn" id="submitBtn" style="display:none;" onclick="submitInquiry()">전송</button>
    `,
    faq: `
      <div class="paper" id="paper">
        <div class="paper-head">
          <button class="close-btn" onclick="closeSheet()">✕</button>
        </div>
        <p class="paper-text">최한민 요청 서비스에 온 것을 환영합니다. 사실 만든 이유는 제가 공부하려고 만든거지, 별 의미가 있지는 않습니다. 어쩌면 언젠가 의미가 생길 수도 있겠네요. 버튼은 매우 직관적이니 FAQ는 사실 안 필요하다고도 보입니다ㅎㅎ</p>
      </div>
    `,
    changelog: `
      <div class="sheet-head">
        <p class="sheet-title">업데이트 내역</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <p class="version-tag">Ver 4.5</p>
      <div class="faq-item"><p class="faq-a">배경에 흰 햄스터 "메리"와 회갈색 햄스터 "찰스"를 추가했습니다. 목에 이름표를 달고 있습니다.</p></div>
      <div class="faq-item"><p class="faq-a">메리와 찰스가 랜덤으로 잠을 자거나, 해바라기씨를 먹거나, 쳇바퀴를 돌립니다.</p></div>
      <div class="faq-item"><p class="faq-a">낮에는 배경에 꽃잎이 흩날립니다.</p></div>
      <p class="version-tag">Ver 4.0</p>
      <div class="faq-item"><p class="faq-a">출석 스트릭, 포인트(방명록/투표 참여 시 적립) 기능을 추가했습니다.</p></div>
      <div class="faq-item"><p class="faq-a">글자 크기 조절, 테마 컬러 선택, 즐겨찾기 바로가기를 추가했습니다.</p></div>
      <div class="faq-item"><p class="faq-a">D-day 배너와 공지사항 배너를 관리자가 설정할 수 있습니다.</p></div>
      <div class="faq-item"><p class="faq-a">QR코드 보기, 관리자 대시보드 CSV 다운로드/검색·필터/평균 응답시간/활동 로그를 추가했습니다.</p></div>
      <div class="faq-item"><p class="faq-a">문의 작성 시 음성 입력을 지원합니다 (지원 브라우저 한정).</p></div>
      <div class="faq-item"><p class="faq-a">로그인 코드를 5번 틀리면 5분간 잠기도록 무차별 대입 방지 기능을 추가했습니다.</p></div>
      <div class="faq-item"><p class="faq-a">방명록/롤링페이퍼에 좋아요·답글 기능을 추가했습니다.</p></div>
      <div class="faq-item"><p class="faq-a">밸런스 게임/투표에 첫 투표자 뱃지를 추가했습니다.</p></div>
      <div class="faq-item"><p class="faq-a">"내 신청 내역"에 답변 대기 건수 안내를 추가했습니다.</p></div>
      <div class="faq-item"><p class="faq-a">회원가입에 생일(선택) 입력을 추가해, 생일에 로그인하면 축하 메시지가 뜹니다.</p></div>
      <div class="faq-item"><p class="faq-a">겨울(12~2월)에는 배경에 눈이 내립니다. 수달을 7번 클릭하면 숨겨진 메시지가 나옵니다.</p></div>
      <div class="faq-item"><p class="faq-a">기타 서비스에 최근 활동, 초대 랭킹을 추가했습니다.</p></div>
      <div class="faq-item"><p class="faq-a">약속의 동행자란에 여러 명을 함께 적을 수 있도록 안내를 수정했습니다.</p></div>
      <p class="version-tag">Ver 3.5</p>
      <div class="faq-item">
        <p class="faq-a">관리자가 문의/약속 상태를 수락·거절로 바꾸면, 사유와 함께 신청자 본인에게 자동으로 결과 메일이 갑니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">"내 신청 내역" 메뉴를 추가했습니다. 로그인한 계정 기준으로 내가 보낸 문의/약속을 확인할 수 있습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">채팅에 안읽음 표시(빨간 점)를 추가했습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">관리자 대시보드에서 "현재 상태"를 자동(시간표) 대신 수동으로 고정할 수 있게 되었습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">"기타 서비스"가 실제로 작동합니다: 방명록, 롤링페이퍼, 밸런스 게임/투표, 오늘의 운세, 위시리스트, 요즘 관심사, 게임 전적, 공개 스케줄이 추가되었습니다.</p>
      </div>
      <p class="version-tag">Ver 3.0</p>
      <div class="faq-item">
        <p class="faq-a">Firebase 실시간 데이터베이스를 도입했습니다. 문의/약속/회원 데이터가 백엔드에 쌓입니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">관리자 전용 대시보드를 추가했습니다 (footer의 "🛠 관리자"). 문의·약속 목록을 보고 대기중/수락/거절/완료로 상태를 바꿀 수 있고, 기본 통계도 볼 수 있습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">약속 시간이 관리자가 등록한 "바쁜 시간"과 겹치면 자동으로 막히도록 캘린더 충돌 체크를 추가했습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">회원과 최한민이 실시간으로 대화할 수 있는 채팅 기능을 추가했습니다 (우측 하단 💬 버튼).</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">푸시 알림 기반을 추가했습니다. 현재는 알림 토큰 수집까지 자동이며, 실제 발송은 Firebase 콘솔에서 수동으로 합니다.</p>
      </div>
      <p class="version-tag">Ver 2.9</p>
      <div class="faq-item">
        <p class="faq-a">로그인된 화면 상단에 "로그아웃" 버튼을 추가했습니다. 누르기 전까지는 자동으로 로그아웃되지 않습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">"공부/대외활동 등 활동 약속"을 "공부/대외활동 등 학습 활동 약속"으로 이름을 바꿨습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">"최한민은 누구인가요?"의 6개 버튼 순서가 열 때마다 랜덤으로 섞입니다.</p>
      </div>
      <p class="version-tag">Ver 2.8</p>
      <div class="faq-item">
        <p class="faq-a">"문의 남기기"와 "기타 서비스" 사이에 "최한민에게 DM 보내기" 버튼을 추가했습니다. 인스타그램 프로필로 바로 이동합니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">로그인 화면의 "인증번호 받기" 버튼을 "로그인 하기"로 바꿨습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">파비콘과 홈 화면 아이콘을 활짝 웃으며 손을 흔드는 수달로 새로 그렸습니다.</p>
      </div>
      <p class="version-tag">Ver 2.7</p>
      <div class="faq-item">
        <p class="faq-a">이름·이메일·사용 가능 코드를 입력해야 서비스를 이용할 수 있는 로그인 게이트를 추가했습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">가짜 정보로 입장하는 걸 막기 위해, 이름은 한글 2~3글자만(영어 불가), 이메일은 gmail/naver/kakao 도메인만 허용하도록 검증을 강화했습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">이메일로 실제 인증번호를 보내고, 그걸 정확히 입력해야만 로그인/회원가입이 완료되도록 이메일 인증 절차를 추가했습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">로그인 화면 아래에 "회원가입" 메뉴를 추가했습니다. 이름·이메일 입력 후 이메일 인증을 마치면 사용 가능 코드를 알려드립니다.</p>
      </div>
      <p class="version-tag">Ver 2.6</p>
      <div class="faq-item">
        <p class="faq-a">치와와 목에 "헨리" 이름표 목걸이를 달아줬습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">치와와가 이제 가끔 옆모습으로도 보입니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">수달 옆에 블랙탄 치와와를 추가했습니다. 혀를 내밀거나, 화를 내거나, 간식을 먹거나, 주변을 배회합니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">최한민의 현재 상태판을 다른 버튼들과 구분되는 전용 위젯 디자인으로 바꾸고, 위에 "최한민은 지금..." 문구와 아이콘을 추가했습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">문의 접수 확인메일 문구를 "[접수 성공] 문의가 접수되었습니다" 형식으로 정리했습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">수달이 통통 뛰고, 가끔 손을 흔듭니다.</p>
      </div>

      <div class="faq-item">
        <p class="faq-a">낮에는 수달이 땀을 흘리고 배경에 아지랑이가 피어오릅니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">밤에는 반딧불이가 보입니다 (다크모드와 함께 이어지는 기능입니다).</p>
      </div>
      <p class="version-tag">Ver 2.5</p>
      <div class="faq-item">
        <p class="faq-a">폰 홈 화면에 앱처럼 추가할 수 있게 되었습니다 (PWA).</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">"링크 복사" 버튼을 추가했습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">주요 버튼을 누르면 작은 클릭 사운드가, 전송에 성공하면 성공 사운드가 재생됩니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">밤(다크 모드)에는 배경에 반딧불이가 은은하게 떠다닙니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">약속 신청 완료 후 "내 캘린더에 추가" 버튼으로 .ics 파일을 바로 받을 수 있습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">문의/약속 신청 내역을 구글 시트에 자동으로 기록할 수 있는 기능을 추가했습니다 (선택 설정).</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">실제 서울 날씨(맑음/흐림/비/눈)를 배경 하늘에 아이콘으로 반영합니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">누적 방문자 수를 하단에 표시합니다.</p>
      </div>
      <p class="version-tag">Ver 2.0</p>
      <div class="faq-item">
        <p class="faq-a">파비콘(브라우저 탭 아이콘)을 수달 얼굴로 추가했습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">카카오톡/인스타 등에 링크 공유 시 미리보기 카드(제목·설명·이미지)가 뜨도록 만들었습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">전송 성공 시 체크마크와 컨페티가 터지는 축하 애니메이션을 추가했습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">약속 시간을 잠자는 시간대(02시~06시30분)로 고르면 답장이 늦을 수 있다는 경고 문구가 뜹니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">문의/약속 신청 후 보내는 분 이메일로도 접수 확인 메일이 자동으로 갑니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">1분 이내 재전송을 막는 도배 방지 기능을 추가했습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">라이트/다크 모드를 자동(시간 기준) 외에 직접 수동으로도 전환할 수 있는 버튼을 추가했습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">아기 수달이 가끔 눈을 깜빡입니다.</p>
      </div>
      <p class="version-tag">Ver 1.3</p>
      <div class="faq-item">
        <p class="faq-a">문의 남기기에 카톡/인스타 DM 문의 안내를 추가했습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">낮(06시~18시)엔 태양과 함께 라이트 모드로, 밤(18시~06시)엔 보름달과 함께 다크 모드로 자동 전환됩니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">태양/보름달/별이 화면 위쪽에 가려 안 보이던 문제를 고쳐서, 언덕 바로 위 하늘에 보이도록 위치를 조정했습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">다크 모드에서 "약속 잡기", "문의 남기기", "최한민은 누구인가요?" 글자가 잘 안 보이던 문제를 고쳐서 노란색으로 바꿨습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">제작자 표시를 추가했습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">수달을 더 수달답게 다시 그렸습니다. 곰 아니에요.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">최한민은 누구인가요에 항목을 추가했습니다.</p>
      </div>
      <p class="version-tag">Ver 1.2</p>
      <div class="faq-item">
        <p class="faq-a">보내는 사람 분류를 추가하였습니다.</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">최한민의 현 Status를 바둑판식으로 보여드립니다. 잠자는 중엔 웬만하면 건드리지 마세용</p>
      </div>
      <p class="version-tag">Ver 1.1</p>
      <div class="faq-item">
        <p class="faq-a">배경화면을 말 그대로 자연스럽게 추가했습니다. 대.자.연 ㅋㅋ</p>
      </div>
      <div class="faq-item">
        <p class="faq-a">아기 수달을 추가했습니다. 저를 모티브로 그린 겁니다.</p>
      </div>
    `
  };

  // ══════════════════════════════════════════════════════════
  //  회원 게이트 — Firebase Auth 이메일 링크(비밀번호 없는 로그인)
  //  · 인증 코드 생성/검증이 전부 구글 서버에서 이루어집니다.
  //  · 초대 코드는 클라이언트에 존재하지 않고 Cloud Functions 가 검증합니다.
  //  · 회원 여부는 Firestore members 문서 + 보안 규칙이 판정합니다.
  // ══════════════════════════════════════════════════════════

  const EMAIL_FOR_SIGNIN_KEY = 'emailForSignIn';

  let memberProfile = null;
  let gateLinkCooldownUntil = 0;

  function isMember(){
    return !!memberProfile;
  }

  function isValidGateName(name){
    return /^[가-힣]{2,3}$/.test(String(name || '').trim());
  }

  function actionCodeSettings(){
    return {
      url: window.location.origin + window.location.pathname,
      handleCodeInApp: true
    };
  }

  function setGateHint(id, msg){
    const el = document.getElementById(id);
    if(el) el.textContent = msg || '';
  }

  // ── 1) 로그인 링크 발송 ──────────────────────────────────
  async function sendLoginLink(){
    const emailInput = document.getElementById('gateEmail');
    const email = emailInput.value.trim().toLowerCase();

    if(!firebaseReady){
      setGateHint('gateStep1Hint', "Firebase 설정이 필요합니다.");
      return;
    }
    if(!isAllowedEmail(email)){
      setGateHint('gateStep1Hint', "gmail.com / naver.com / kakao.com 주소만 사용할 수 있어요.");
      return;
    }
    if(Date.now() < gateLinkCooldownUntil){
      const sec = Math.ceil((gateLinkCooldownUntil - Date.now()) / 1000);
      setGateHint('gateStep1Hint', sec + "초 후 다시 시도해주세요.");
      return;
    }

    setGateHint('gateStep1Hint', '');
    const btn = document.getElementById('gateRequestBtn');
    if(btn){ btn.disabled = true; btn.textContent = "전송 중..."; }

    try{
      await auth.sendSignInLinkToEmail(email, actionCodeSettings());
      try{ window.localStorage.setItem(EMAIL_FOR_SIGNIN_KEY, email); }catch(e){}
      gateLinkCooldownUntil = Date.now() + 60000;

      document.getElementById('gateOtpSentTo').textContent = email + " 로 로그인 링크를 보냈어요.";
      setGateHint('gateStep2Hint', '');
      showGatePanel('gateStep2');
    }catch(err){
      console.warn("로그인 링크 발송 실패:", err);
      let msg = "링크 전송에 실패했어요. 잠시 후 다시 시도해주세요.";
      if(err.code === 'auth/invalid-email') msg = "이메일 형식이 올바르지 않아요.";
      if(err.code === 'auth/too-many-requests') msg = "요청이 너무 많아요. 잠시 후 다시 시도해주세요.";
      if(err.code === 'auth/unauthorized-continue-uri') msg = "이 도메인이 Firebase 승인 목록에 없어요. (설정 필요)";
      setGateHint('gateStep1Hint', msg);
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = "로그인 링크 받기"; }
    }
  }

  function backToGateStep1(){
    showGatePanel('gateStep1');
  }

  // ── 2) 메일 링크로 돌아왔을 때 자동 로그인 ────────────────
  async function consumeSignInLink(){
    if(!firebaseReady) return false;
    if(!auth.isSignInWithEmailLink(window.location.href)) return false;

    showGatePanel('gateLoading');

    let email = null;
    try{ email = window.localStorage.getItem(EMAIL_FOR_SIGNIN_KEY); }catch(e){}
    if(!email){
      // 다른 기기/브라우저에서 링크를 연 경우
      email = window.prompt("보안 확인을 위해 로그인 링크를 요청한 이메일을 다시 입력해주세요.");
      if(email) email = email.trim().toLowerCase();
    }
    if(!email){
      showGatePanel('gateStep1');
      setGateHint('gateStep1Hint', "이메일 확인이 필요해요. 다시 시도해주세요.");
      return false;
    }

    try{
      await auth.signInWithEmailLink(email, window.location.href);
      try{ window.localStorage.removeItem(EMAIL_FOR_SIGNIN_KEY); }catch(e){}
      // URL에서 인증 파라미터 제거 (뒤로가기/공유 시 유출 방지)
      window.history.replaceState({}, document.title,
        window.location.origin + window.location.pathname);
      return true;
    }catch(err){
      console.warn("링크 로그인 실패:", err);
      showGatePanel('gateStep1');
      let msg = "로그인에 실패했어요. 링크를 다시 받아주세요.";
      if(err.code === 'auth/invalid-action-code') msg = "링크가 만료되었거나 이미 사용됐어요. 다시 받아주세요.";
      setGateHint('gateStep1Hint', msg);
      return false;
    }
  }

  // ── 3) 로그인 상태 변화 처리 ─────────────────────────────
  async function handleAuthState(user){
    const overlay = document.getElementById('gateOverlay');

    if(!user){
      memberProfile = null;
      isAdminLoggedIn = false;
      const btn = document.getElementById('adminEntryBtn');
      if(btn) btn.style.display = 'none';
      overlay.classList.remove('gate-hidden');
      showGatePanel('gateStep1');
      return;
    }

    showGatePanel('gateLoading');

    let res;
    try{
      res = await callFn('getMyProfile');
    }catch(err){
      console.warn("프로필 조회 실패:", err);
      showGatePanel('gateStep1');
      setGateHint('gateStep1Hint',
        (err && err.message) ? err.message : "확인에 실패했어요. 다시 시도해주세요.");
      return;
    }

    if(!res.isMember){
      // 가입 전 → 초대 코드 입력 단계
      memberProfile = null;
      const label = document.getElementById('signupEmailLabel');
      if(label) label.textContent = user.email + " 계정으로 가입을 마칠게요.";
      showGatePanel('gateSignupStep1');
      return;
    }

    memberProfile = res.profile;
    await refreshAdminClaim();
    enterApp();
  }

  // ── 4) 가입 완료 (초대 코드는 서버가 검증) ────────────────
  async function completeSignup(){
    const name = document.getElementById('signupName').value.trim();
    const birthday = document.getElementById('signupBirthday').value || '';
    const invite = document.getElementById('signupInvite').value;

    if(!isValidGateName(name)){
      setGateHint('signupStep1Hint', "이름은 한글 2~3글자로 입력해주세요 (영어 불가).");
      return;
    }
    if(!invite){
      setGateHint('signupStep1Hint', "초대 코드를 입력해주세요.");
      return;
    }

    setGateHint('signupStep1Hint', '');
    const btn = document.getElementById('signupRequestBtn');
    if(btn){ btn.disabled = true; btn.textContent = "확인 중..."; }

    let referredBy = '';
    try{ referredBy = sessionStorage.getItem('referredBy') || ''; }catch(e){}

    try{
      const res = await callFn('completeSignup', {
        name: name, birthday: birthday, inviteCode: invite, referredBy: referredBy
      });
      memberProfile = res.profile;
      document.getElementById('signupInvite').value = '';
      await refreshAdminClaim();
      enterApp();
      showToast("🎉 가입이 완료됐어요!");
      playSuccessAnimation();
    }catch(err){
      console.warn("가입 실패:", err);
      setGateHint('signupStep1Hint',
        (err && err.message) ? err.message : "가입에 실패했어요. 잠시 후 다시 시도해주세요.");
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = "가입 완료하고 입장하기"; }
    }
  }

  // ── 5) 입장 ──────────────────────────────────────────────
  function enterApp(){
    document.getElementById('gateOverlay').classList.add('gate-hidden');
    const email = getCurrentMemberEmail();
    if(!email) return;

    registerPushToken(email);
    watchChatBadge(email);
    updateVisitorCount();

    if(memberProfile && memberProfile.birthday){
      const today = new Date();
      const todayMD = String(today.getMonth() + 1).padStart(2, '0') + '-'
                    + String(today.getDate()).padStart(2, '0');
      if(todayMD === memberProfile.birthday.slice(5)){
        setTimeout(()=>{ playSuccessAnimation(); showToast("🎂 생일 축하해요!"); }, 800);
      }
    }
  }

  async function signOutMember(){
    try{ await auth.signOut(); }catch(e){}
    memberProfile = null;
    isAdminLoggedIn = false;
    try{ localStorage.removeItem('memberInfo'); }catch(e){}
    document.getElementById('gateOverlay').classList.remove('gate-hidden');
    showGatePanel('gateStep1');
  }

  // 기존 호출부 호환
  function logoutMember(){ signOutMember(); }

  // ── 앱 진입점: 인증 상태를 구독하고, 메일 링크가 있으면 소비 ──
  async function initGate(){
    if(!firebaseReady){
      // Firebase 미설정 시에도 화면이 죽지 않도록 안내만 표시
      showGatePanel('gateStep1');
      setGateHint('gateStep1Hint', "Firebase 설정이 필요합니다.");
      return;
    }
    await consumeSignInLink();
    auth.onAuthStateChanged(handleAuthState);
  }
  initGate();

  // ── 출석 스트릭 & 포인트 ──
  function updateStreak(){
    try{
      const today = new Date().toISOString().slice(0, 10);
      const last = localStorage.getItem('lastVisitDate');
      let streak = parseInt(localStorage.getItem('visitStreak') || '0', 10);
      if(last === today) { /* 오늘 이미 방문 */ }
      else{
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        streak = (last === yesterday) ? streak + 1 : 1;
        localStorage.setItem('visitStreak', String(streak));
        localStorage.setItem('lastVisitDate', today);
      }
      const badge = document.getElementById('streakBadge');
      if(badge) badge.textContent = "🔥 " + streak + "일 연속 방문";
    }catch(e){ /* ignore */ }
  }

  function addPoints(amount){
    try{
      const pts = parseInt(localStorage.getItem('myPoints') || '0', 10) + amount;
      localStorage.setItem('myPoints', String(pts));
      return pts;
    }catch(e){ return 0; }
  }

  function getMyLevel(){
    const pts = parseInt(localStorage.getItem('myPoints') || '0', 10);
    if(pts >= 100) return { name: '단골 회원', pts };
    if(pts >= 30) return { name: '활발한 회원', pts };
    return { name: '새싹 회원', pts };
  }

  // ── 글자 크기 조절 ──
  function cycleFontSize(){
    const sizes = ['fs-normal', 'fs-large', 'fs-small'];
    const current = localStorage.getItem('fontSizePref') || 'fs-normal';
    const next = sizes[(sizes.indexOf(current) + 1) % sizes.length];
    localStorage.setItem('fontSizePref', next);
    applyFontSize();
  }

  function applyFontSize(){
    const pref = localStorage.getItem('fontSizePref') || 'fs-normal';
    document.documentElement.classList.remove('fs-normal', 'fs-large', 'fs-small');
    document.documentElement.classList.add(pref);
  }
  applyFontSize();

  // ── D-day 배너 (관리자가 설정) ──
  async function loadDdayBanner(){
    if(!firebaseReady) return;
    try{
      const doc = await db.collection('settings').doc('dday').get();
      const banner = document.getElementById('ddayBanner');
      if(!doc.exists || !banner) return;
      const d = doc.data();
      if(!d.label || !d.date) return;
      const diff = Math.ceil((new Date(d.date) - new Date()) / 86400000);
      banner.textContent = "📌 " + d.label + " D" + (diff > 0 ? ("-" + diff) : (diff === 0 ? "-Day" : ("+" + Math.abs(diff))));
      banner.style.display = 'block';
    }catch(e){ /* ignore */ }
  }

  async function loadAnnouncement(){
    if(!firebaseReady) return;
    try{
      const doc = await db.collection('settings').doc('announcement').get();
      const banner = document.getElementById('announceBanner');
      if(!doc.exists || !banner) return;
      const text = doc.data().text;
      if(!text) return;
      banner.textContent = "📢 " + text;
      banner.style.display = 'block';
    }catch(e){ /* ignore */ }
  }

  async function setAnnouncement(){
    if(!firebaseReady) return;
    const text = prompt("공지사항 문구를 입력하세요 (비우면 삭제):", "");
    if(text === null) return;
    try{
      if(text.trim()){
        await db.collection('settings').doc('announcement').set({ text: text.trim() });
      }else{
        await db.collection('settings').doc('announcement').delete();
      }
      showToast("공지사항이 업데이트됐어요");
      logAdminAction("공지사항 변경: " + (text.trim() || "(삭제)"));
      loadAnnouncement();
    }catch(err){
      showToast("업데이트에 실패했어요");
    }
  }

  async function setDdayTarget(){
    if(!firebaseReady) return;
    const label = prompt("디데이 라벨(예: 시험):", "");
    if(label === null || !label.trim()) return;
    const date = prompt("날짜(YYYY-MM-DD):", "");
    if(!date) return;
    try{
      await db.collection('settings').doc('dday').set({ label: label.trim(), date: date });
      showToast("디데이가 설정됐어요");
      loadDdayBanner();
    }catch(err){
      showToast("설정에 실패했어요");
    }
  }

  // ── 리퍼럴(초대 링크) 추적 ──
  function captureReferral(){
    try{
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if(ref) sessionStorage.setItem('referredBy', ref);
    }catch(e){ /* ignore */ }
  }
  captureReferral();

  updateStreak();
  loadDdayBanner();
  loadAnnouncement();

  // ── 게이트 패널 전환 ──
  function showGatePanel(id){
    ['gateStep1', 'gateStep2', 'gateSignupStep1', 'gateInfo', 'gateLoading']
      .forEach(panelId => {
        const el = document.getElementById(panelId);
        if(el) el.style.display = (panelId === id) ? 'block' : 'none';
      });
  }

  let selectedTag = null;
  let selectedRelation = null;

  function buildWhoSheet(){
    const personas = [
      { label: '귀요미', mood: 'good' },
      { label: '공주', mood: 'good' },
      { label: '자유로운파랑새', mood: 'good' },
      { label: '꿀꿀돼지', mood: 'bad' },
      { label: '늙크크', mood: 'bad' },
      { label: '영포티', mood: 'bad' }
    ];
    for(let i = personas.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [personas[i], personas[j]] = [personas[j], personas[i]];
    }
    const buttons = personas.map(p =>
      `<button class="option-btn" onclick="personaChoice('${p.mood}')">${p.label}</button>`
    ).join('');
    return `
      <div class="sheet-head">
        <p class="sheet-title">최한민은 누구인가요?</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <div class="option-list">${buttons}</div>
    `;
  }

  const DYNAMIC_SHEET_TYPES = ['mySubmissions', 'guestbook', 'rollingPaper', 'vote', 'fortune', 'publicSchedule'];

  function firestoreNotReadyHtml(title){
    return `
      <div class="sheet-head">
        <p class="sheet-title">${title}</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <p class="field-hint field-hint--static">이 기능은 Firebase 설정 후 사용할 수 있어요.</p>
    `;
  }

  // ── 내 신청 내역 ──
  async function renderMySubmissions(){
    const sheetEl = document.getElementById('sheet');
    if(!firebaseReady){ sheetEl.innerHTML = firestoreNotReadyHtml('내 신청 내역'); return; }
    const email = getCurrentMemberEmail();
    if(!email){ sheetEl.innerHTML = firestoreNotReadyHtml('내 신청 내역'); return; }
    try{
      const [inquirySnap, apptSnap] = await Promise.all([
        db.collection('inquiries').where('email', '==', email).orderBy('createdAt', 'desc').limit(100).get(),
        db.collection('appointments').where('email', '==', email).orderBy('createdAt', 'desc').limit(100).get()
      ]);
      const inquiryRows = inquirySnap.docs.map(doc => {
        const d = doc.data();
        return `<div class="admin-row">
          <div class="admin-row-title">📩 ${escapeHtml(d.title || '')}</div>
          <div class="admin-row-meta">${escapeHtml(d.category || '')} · 상태: ${escapeHtml(d.status || '대기중')}</div>
        </div>`;
      }).join('');
      const apptRows = apptSnap.docs.map(doc => {
        const d = doc.data();
        return `<div class="admin-row">
          <div class="admin-row-title">📅 ${escapeHtml(d.appointmentType || '')}</div>
          <div class="admin-row-meta">${escapeHtml(d.datetimeDisplay || '')} · 상태: ${escapeHtml(d.status || '대기중')}</div>
        </div>`;
      }).join('');
      const pendingCount = [...inquirySnap.docs, ...apptSnap.docs].filter(doc => (doc.data().status || '대기중') === '대기중').length;
      sheetEl.innerHTML = `
        <div class="sheet-head">
          <p class="sheet-title">내 신청 내역</p>
          <button class="close-btn" onclick="closeSheet()">✕</button>
        </div>
        ${pendingCount > 0 ? `<p class="field-hint field-hint--static">⏳ 아직 답변 대기중인 신청이 ${pendingCount}건 있어요.</p>` : ''}
        ${inquiryRows || apptRows ? (inquiryRows + apptRows) : '<p class="field-hint">아직 신청한 내역이 없어요.</p>'}
      `;
    }catch(err){
      sheetEl.innerHTML = firestoreNotReadyHtml('내 신청 내역');
    }
  }

  // ── 방명록 ──
  async function renderGuestbook(){
    const sheetEl = document.getElementById('sheet');
    if(!firebaseReady){ sheetEl.innerHTML = firestoreNotReadyHtml('📖 방명록'); return; }
    sheetEl.innerHTML = `
      <div class="sheet-head">
        <p class="sheet-title">📖 방명록</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <div class="form-group">
        <textarea class="form-textarea" id="guestbookInput" placeholder="한마디 남겨주세요" style="min-height:70px;"></textarea>
      </div>
      <button class="submit-btn" onclick="submitGuestbookEntry()">남기기</button>
      <div id="guestbookList" style="margin-top:16px;"></div>
    `;
    try{
      const snap = await db.collection('guestbook').orderBy('createdAt', 'desc').limit(30).get();
      document.getElementById('guestbookList').innerHTML = snap.docs.map(doc => {
        const d = doc.data();
        const replies = (d.replies || []).map(r => `<div style="margin-left:14px;margin-top:4px;font-size:12px;color:var(--ink-soft);">↳ ${escapeHtml(r)}</div>`).join('');
        return `<div class="admin-row"><div class="admin-row-title">${escapeHtml(d.name || '익명')}</div><div>${escapeHtml(d.message || '')}</div>
          ${replies}
          <button class="back-link" onclick="likeEntry('guestbook','${escapeAttr(doc.id)}')">❤️ ${Number(d.likes) || 0}</button>
          <button class="back-link" onclick="replyToGuestbook('${escapeAttr(doc.id)}')">💬 답글</button>
        </div>`;
      }).join('') || '<p class="field-hint">아직 방명록이 비어있어요.</p>';
    }catch(err){ /* ignore */ }
  }

  async function replyToGuestbook(docId){
    if(!firebaseReady) return;
    const text = prompt("답글을 입력하세요:");
    if(!text || !text.trim()) return;
    try{
      await db.collection('guestbook').doc(docId).update({
        replies: firebase.firestore.FieldValue.arrayUnion(text.trim())
      });
      renderGuestbook();
    }catch(err){
      showToast("답글 등록에 실패했어요");
    }
  }

  async function likeEntry(collectionName, docId){
    if(!firebaseReady) return;
    const likedKey = 'liked_' + collectionName + '_' + docId;
    if(localStorage.getItem(likedKey)) return;
    try{
      await db.collection(collectionName).doc(docId).update({
        likes: firebase.firestore.FieldValue.increment(1)
      });
      localStorage.setItem(likedKey, '1');
      if(collectionName === 'guestbook') renderGuestbook(); else renderRollingPaper();
    }catch(err){ /* ignore */ }
  }

  async function submitGuestbookEntry(){
    const input = document.getElementById('guestbookInput');
    const text = input.value.trim();
    if(!text) return;
    const email = getCurrentMemberEmail();
    if(!email){ showToast("로그인 후 이용할 수 있어요"); return; }
    if(text.length > 500){ showToast("500자 이내로 남겨주세요"); return; }
    try{
      await db.collection('guestbook').add({
        name: (memberProfile && memberProfile.name) ? memberProfile.name : '익명',
        email: email,
        message: text,
        likes: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      addPoints(5);
      renderGuestbook();
    }catch(err){
      showToast("방명록 등록에 실패했어요");
    }
  }

  // ── 롤링페이퍼 ──
  async function renderRollingPaper(){
    const sheetEl = document.getElementById('sheet');
    if(!firebaseReady){ sheetEl.innerHTML = firestoreNotReadyHtml('📝 롤링페이퍼'); return; }
    sheetEl.innerHTML = `
      <div class="sheet-head">
        <p class="sheet-title">📝 롤링페이퍼</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <div class="form-group">
        <textarea class="form-textarea" id="rollingPaperInput" placeholder="한마디 붙여주세요" style="min-height:70px;"></textarea>
      </div>
      <button class="submit-btn" onclick="submitRollingPaperEntry()">붙이기</button>
      <div id="rollingPaperList" style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:8px;"></div>
    `;
    const colors = ['#FFF3C4', '#FFD9E8', '#D9F2E6', '#DCE6FF'];
    try{
      const snap = await db.collection('rollingPaper').orderBy('createdAt', 'desc').limit(20).get();
      document.getElementById('rollingPaperList').innerHTML = snap.docs.map((doc, i) => {
        const d = doc.data();
        return `<div style="background:${colors[i % colors.length]};border-radius:10px;padding:10px;font-size:12.5px;color:#3A362B;">
          <div>${escapeHtml(d.message || '')}</div>
          <button class="back-link" style="margin-top:6px;color:#3A362B;" onclick="likeEntry('rollingPaper','${escapeAttr(doc.id)}')">❤️ ${Number(d.likes) || 0}</button>
        </div>`;
      }).join('') || '<p class="field-hint">아직 롤링페이퍼가 비어있어요.</p>';
    }catch(err){ /* ignore */ }
  }

  async function submitRollingPaperEntry(){
    const input = document.getElementById('rollingPaperInput');
    const text = input.value.trim();
    if(!text) return;
    const rpEmail = getCurrentMemberEmail();
    if(!rpEmail){ showToast("로그인 후 이용할 수 있어요"); return; }
    if(text.length > 300){ showToast("300자 이내로 남겨주세요"); return; }
    try{
      await db.collection('rollingPaper').add({
        message: text,
        email: rpEmail,
        likes: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      addPoints(5);
      renderRollingPaper();
    }catch(err){
      showToast("등록에 실패했어요");
    }
  }

  // ── 밸런스 게임 / 투표 ──
  async function renderVote(){
    const sheetEl = document.getElementById('sheet');
    if(!firebaseReady){ sheetEl.innerHTML = firestoreNotReadyHtml('🗳️ 밸런스 게임/투표'); return; }
    try{
      const doc = await db.collection('polls').doc('current').get();
      const d = doc.exists ? doc.data() : { question: '아직 등록된 투표가 없어요', optionA: '', optionB: '', votesA: 0, votesB: 0 };
      const votedKey = 'voted_' + (doc.id || 'current');
      const alreadyVoted = localStorage.getItem(votedKey);
      const total = (d.votesA || 0) + (d.votesB || 0);
      const pctA = total ? Math.round((d.votesA || 0) / total * 100) : 0;
      const pctB = total ? 100 - pctA : 0;

      sheetEl.innerHTML = `
        <div class="sheet-head">
          <p class="sheet-title">🗳️ 밸런스 게임/투표</p>
          <button class="close-btn" onclick="closeSheet()">✕</button>
        </div>
        <p class="gate-sub" style="text-align:left;">${escapeHtml(d.question || '')}</p>
        ${(!d.optionA) ? '' : (alreadyVoted ? `
          <div class="admin-row"><div class="admin-row-title">${escapeHtml(d.optionA)}</div><div class="admin-row-meta">${pctA}% (${Number(d.votesA) || 0}표)</div></div>
          <div class="admin-row"><div class="admin-row-title">${escapeHtml(d.optionB)}</div><div class="admin-row-meta">${pctB}% (${Number(d.votesB) || 0}표)</div></div>
        ` : `
          <div class="option-list">
            <button class="option-btn" onclick="submitVote('A')">${escapeHtml(d.optionA)}</button>
            <button class="option-btn" onclick="submitVote('B')">${escapeHtml(d.optionB)}</button>
          </div>
        `)}
      `;
    }catch(err){
      sheetEl.innerHTML = firestoreNotReadyHtml('🗳️ 밸런스 게임/투표');
    }
  }

  async function submitVote(option){
    if(localStorage.getItem('voted_current')) return;
    try{
      const before = await db.collection('polls').doc('current').get();
      const wasEmpty = before.exists && ((before.data().votesA || 0) + (before.data().votesB || 0)) === 0;
      const field = option === 'A' ? 'votesA' : 'votesB';
      await db.collection('polls').doc('current').update({
        [field]: firebase.firestore.FieldValue.increment(1)
      });
      localStorage.setItem('voted_current', '1');
      addPoints(3);
      if(wasEmpty) showToast("🏅 첫 번째 투표자예요!");
      renderVote();
    }catch(err){
      showToast("투표에 실패했어요");
    }
  }

  // ── 오늘의 운세 ──
  function renderFortune(){
    const fortunes = [
      "오늘은 최한민에게 DM을 보내면 답장이 빨리 올 확률이 높습니다 🔮",
      "오늘 하루 좋은 일이 생길 예감! 특히 오후에 ☀️",
      "약속을 잡기 딱 좋은 날입니다. 지금 잡아보세요 📅",
      "괜히 뭔가 잘 풀리는 하루가 될 것 같아요 ✨",
      "오늘은 게임 승률이 좋을지도? 한판 어때요 🎮",
      "누군가에게 먼저 연락해보세요, 좋은 일이 생길 거예요 💌",
      "오늘은 컨디션 관리가 중요한 날입니다 😴",
      "생각지도 못한 곳에서 좋은 소식이 들려올 거예요 🍀"
    ];
    const pick = fortunes[Math.floor(Math.random() * fortunes.length)];
    document.getElementById('sheet').innerHTML = `
      <div class="sheet-head">
        <p class="sheet-title">🔮 오늘의 운세</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      <p class="gate-sub" style="text-align:left;font-size:15px;">${pick}</p>
      <button class="submit-btn" onclick="renderFortune()">다시 뽑기</button>
    `;
  }

  // ── 공개 스케줄 (읽기 전용) ──
  async function renderPublicSchedule(){
    const sheetEl = document.getElementById('sheet');
    if(!firebaseReady){ sheetEl.innerHTML = firestoreNotReadyHtml('📅 공개 스케줄'); return; }
    try{
      const slots = await fetchBusySlots();
      const now = Date.now();
      const upcoming = slots
        .filter(s => new Date(s.end).getTime() > now)
        .sort((a, b) => new Date(a.start) - new Date(b.start));
      sheetEl.innerHTML = `
        <div class="sheet-head">
          <p class="sheet-title">📅 공개 스케줄</p>
          <button class="close-btn" onclick="closeSheet()">✕</button>
        </div>
        <p class="gate-sub" style="text-align:left;">최한민이 이미 바쁜 시간대예요. 약속 잡을 때 참고해주세요.</p>
        ${upcoming.map(s => `<div class="admin-row"><div class="admin-row-title">${escapeHtml(s.label || '일정 있음')}</div><div class="admin-row-meta">${escapeHtml(s.start)} ~ ${escapeHtml(s.end)}</div></div>`).join('') || '<p class="field-hint">현재 등록된 바쁜 시간이 없어요.</p>'}
      `;
    }catch(err){
      sheetEl.innerHTML = firestoreNotReadyHtml('📅 공개 스케줄');
    }
  }

  // ── 최근 활동(익명 공개 피드) ──
  async function renderActivityFeed(){
    const box = document.getElementById('activityFeedList');
    if(!box) return;
    if(!firebaseReady){ box.innerHTML = '<p class="field-hint">Firebase 설정 후 사용할 수 있어요.</p>'; return; }
    try{
      const [inquirySnap, apptSnap] = await Promise.all([
        db.collection('inquiries').orderBy('createdAt', 'desc').limit(5).get(),
        db.collection('appointments').orderBy('createdAt', 'desc').limit(5).get()
      ]);
      const items = [];
      inquirySnap.docs.forEach(doc => items.push({ t: doc.data().createdAt, text: '📩 새 문의가 접수되었습니다' }));
      apptSnap.docs.forEach(doc => items.push({ t: doc.data().createdAt, text: '📅 새 약속 신청이 접수되었습니다' }));
      items.sort((a, b) => (b.t ? b.t.toMillis() : 0) - (a.t ? a.t.toMillis() : 0));
      box.innerHTML = items.slice(0, 8).map(i => {
        const when = i.t ? timeAgo(i.t.toMillis()) : '';
        return `<div class="admin-row"><div class="admin-row-meta">${when}</div><div>${i.text}</div></div>`;
      }).join('') || '<p class="field-hint">아직 활동이 없어요.</p>';
    }catch(err){
      box.innerHTML = '<p class="field-hint">불러오지 못했어요.</p>';
    }
  }

  function timeAgo(ms){
    const diffMin = Math.floor((Date.now() - ms) / 60000);
    if(diffMin < 60) return diffMin + "분 전";
    const diffHour = Math.floor(diffMin / 60);
    if(diffHour < 24) return diffHour + "시간 전";
    return Math.floor(diffHour / 24) + "일 전";
  }

  // ── 초대 랭킹 ──
  async function renderInviteRanking(){
    const box = document.getElementById('inviteRankingList');
    if(!box) return;
    if(!firebaseReady){ box.innerHTML = '<p class="field-hint">Firebase 설정 후 사용할 수 있어요.</p>'; return; }
    try{
      const snap = await db.collection('members').get();
      const counts = {};
      snap.docs.forEach(doc => {
        const ref = doc.data().referredBy;
        if(ref) counts[ref] = (counts[ref] || 0) + 1;
      });
      const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
      box.innerHTML = ranked.map(([name, count], i) =>
        `<div class="admin-row"><div class="admin-row-title">${i + 1}위 · ${escapeHtml(name)}</div><div class="admin-row-meta">${count}명 초대</div></div>`
      ).join('') || '<p class="field-hint">아직 초대 기록이 없어요.</p>';
    }catch(err){
      box.innerHTML = '<p class="field-hint">불러오지 못했어요.</p>';
    }
  }

  // ── 테마 컬러 ──
  function setThemeColor(hex){
    try{ localStorage.setItem('themeColorPref', hex); }catch(e){ /* ignore */ }
    applyThemeColor();
    showToast("테마 컬러가 적용됐어요");
  }

  function applyThemeColor(){
    const hex = localStorage.getItem('themeColorPref');
    if(hex) document.documentElement.style.setProperty('--accent', hex);
  }
  applyThemeColor();

  // ── 즐겨찾기 ──
  function setFavorite(type, label){
    try{
      localStorage.setItem('favoriteAction', JSON.stringify({ type, label }));
    }catch(e){ /* ignore */ }
    showToast(label + " 즐겨찾기로 설정했어요");
    applyFavoriteShortcut();
    closeSheet();
  }

  function clearFavorite(){
    try{ localStorage.removeItem('favoriteAction'); }catch(e){ /* ignore */ }
    applyFavoriteShortcut();
    closeSheet();
  }

  function applyFavoriteShortcut(){
    const btn = document.getElementById('favoriteShortcut');
    if(!btn) return;
    try{
      const fav = JSON.parse(localStorage.getItem('favoriteAction') || 'null');
      if(fav){
        btn.textContent = "⭐ " + fav.label;
        btn.style.display = 'inline-block';
      }else{
        btn.style.display = 'none';
      }
    }catch(e){ btn.style.display = 'none'; }
  }
  applyFavoriteShortcut();

  function launchFavorite(){
    try{
      const fav = JSON.parse(localStorage.getItem('favoriteAction') || 'null');
      if(fav) openSheet(fav.type);
    }catch(e){ /* ignore */ }
  }

  function openSheet(type){
    const sheetEl = document.getElementById('sheet');
    if(type === 'who'){
      sheetEl.innerHTML = buildWhoSheet();
    }else if(DYNAMIC_SHEET_TYPES.includes(type)){
      sheetEl.innerHTML = '<div class="sheet-head"><p class="sheet-title">불러오는 중...</p></div>';
    }else{
      sheetEl.innerHTML = sheetTemplates[type];
    }
    sheetEl.classList.toggle('sheet--paper', type === 'faq');
    selectedTag = null;
    selectedRelation = null;
    document.getElementById('overlay').classList.add('show');
    if(type === 'faq'){
      requestAnimationFrame(()=>{
        setTimeout(()=>{
          const paper = document.getElementById('paper');
          if(paper) paper.classList.add('show');
        }, 30);
      });
    }
    // 로그인 계정 이메일 자동 채움 + 유효성 재계산
    const inqEmail = sheetEl.querySelector('#inquiryEmail');
    if(inqEmail){
      inqEmail.value = getCurrentMemberEmail() || '';
      checkInquiryValidity();
    }
    if(type === 'mySubmissions') renderMySubmissions();
    if(type === 'guestbook') renderGuestbook();
    if(type === 'rollingPaper') renderRollingPaper();
    if(type === 'vote') renderVote();
    if(type === 'fortune') renderFortune();
    if(type === 'publicSchedule') renderPublicSchedule();
    if(type === 'activityFeed') renderActivityFeed();
    if(type === 'inviteRanking') renderInviteRanking();
  }

  function selectTag(btn, tag){
    btn.parentElement.querySelectorAll('.tag-btn').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedTag = tag;
    checkInquiryValidity();
  }

  function selectRelation(btn, relation){
    btn.parentElement.querySelectorAll('.tag-btn').forEach(b=>b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedRelation = relation;
  }

  function checkInquiryValidity(){
    const emailInput = document.getElementById('inquiryEmail');
    const hint = document.getElementById('inquiryEmailHint');
    const btn = document.getElementById('submitBtn');
    if(!emailInput) return;
    const email = emailInput.value;

    if(email.trim() === ""){
      hint.textContent = "";
    }else if(isAllowedEmail(email)){
      hint.textContent = "";
    }else{
      hint.textContent = "gmail.com / naver.com / kakao.com 주소만 사용할 수 있어요";
    }

    const valid = selectedTag && isAllowedEmail(email);
    btn.style.display = valid ? "block" : "none";
  }

  function closeSheet(){
    document.getElementById('overlay').classList.remove('show');
  }

  function showToast(msg){
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(()=>toast.classList.remove('show'), 2200);
  }

  function playSuccessAnimation(){
    playSuccessSound();
    const overlay = document.getElementById('successOverlay');
    overlay.classList.remove('show');
    void overlay.offsetWidth; // restart animation
    overlay.classList.add('show');
    setTimeout(()=>overlay.classList.remove('show'), 1300);

    const colors = ['#3654FF', '#FF6B47', '#FBD34D', '#8FC275', '#F6C9DD'];
    const layer = document.getElementById('confettiLayer');
    for(let i = 0; i < 26; i++){
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = (Math.random() * 0.3) + 's';
      piece.style.animationDuration = (1.1 + Math.random() * 0.6) + 's';
      layer.appendChild(piece);
      setTimeout(()=>piece.remove(), 2200);
    }
  }

  function confirmChoice(label){
    closeSheet();
    showToast(label + " 요청이 접수될 예정이에요");
  }

  let currentApptType = null;
  let selectedGames = new Set();

  let currentApptBusySlots = [];

  function selectAppointmentType(type){
    currentApptType = type;
    selectedGames = new Set();
    currentApptBusySlots = [];
    fetchBusySlots().then(slots => { currentApptBusySlots = slots; });

    const gameSection = type === '게임 약속' ? `
      <div class="form-group">
        <label class="form-label">게임 선택 (중복 가능)</label>
        <div class="tag-group">
          <button type="button" class="tag-btn" onclick="toggleGameTag(this,'오버워치')">오버워치</button>
          <button type="button" class="tag-btn" onclick="toggleGameTag(this,'레식 시즈')">레식 시즈</button>
          <button type="button" class="tag-btn" onclick="toggleGameTag(this,'기타 스팀 게임')">기타 스팀 게임</button>
        </div>
      </div>
    ` : '';

    document.getElementById('sheet').innerHTML = `
      <button class="back-link" onclick="openSheet('appointment')">← 다른 약속 선택</button>
      <div class="sheet-head">
        <p class="sheet-title">${type}</p>
        <button class="close-btn" onclick="closeSheet()">✕</button>
      </div>
      ${gameSection}
      <div class="form-group">
        <label class="form-label" for="apptEmail">보내는 사람 이메일 (로그인 계정)</label>
        <input class="form-input" id="apptEmail" type="email" readonly
               value="${escapeAttr(getCurrentMemberEmail() || '')}"
               style="background:var(--accent-soft);cursor:not-allowed;">
        <p class="field-hint" id="apptEmailHint"></p>
      </div>
      <div class="form-group">
        <label class="form-label">약속 신청자</label>
        <input class="form-input" id="apptApplicant" type="text" placeholder="이름을 입력해주세요">
      </div>
      <div class="form-group">
        <label class="form-label">동행자</label>
        <input class="form-input" id="apptCompanion" type="text" placeholder="함께하는 사람 (2명 이상이면 쉼표로 구분)">
      </div>
      <div class="form-group">
        <label class="form-label">날짜 및 시간</label>
        <input class="form-input" id="apptDatetime" type="datetime-local" oninput="checkSleepWarning()">
        <p class="field-hint" id="sleepWarningHint"></p>
      </div>
      <button class="submit-btn" id="apptSubmitBtn" style="display:none;" onclick="submitAppointment('${type}')">신청 보내기</button>
    `;
    checkApptValidity();
  }

  function toggleGameTag(btn, game){
    if(selectedGames.has(game)){
      selectedGames.delete(game);
      btn.classList.remove('selected');
    }else{
      selectedGames.add(game);
      btn.classList.add('selected');
    }
    checkApptValidity();
  }

  function checkApptValidity(){
    const email = document.getElementById('apptEmail').value;
    const hint = document.getElementById('apptEmailHint');
    const btn = document.getElementById('apptSubmitBtn');

    const emailValid = email.trim() !== "" && isAllowedEmail(email);
    const gameValid = currentApptType !== '게임 약속' || selectedGames.size > 0;

    if(email.trim() !== "" && !isAllowedEmail(email)){
      hint.textContent = "gmail.com / naver.com / kakao.com 주소만 사용할 수 있어요";
    }else{
      hint.textContent = "";
    }

    btn.style.display = (emailValid && gameValid) ? "block" : "none";
  }

  function formatDatetime(value){
    const [datePart, timePart] = value.split('T');
    const [y,m,d] = datePart.split('-');
    const [h,min] = timePart.split(':');
    return `${parseInt(m)}월 ${parseInt(d)}일 ${h}시 ${min}분`;
  }

  function checkSleepWarning(){
    const input = document.getElementById('apptDatetime');
    const hint = document.getElementById('sleepWarningHint');
    if(!input || !hint || !input.value) return;
    const [, timePart] = input.value.split('T');
    const [h, min] = timePart.split(':').map(Number);
    const mins = h * 60 + min;
    const isSleepTime = (mins >= 120 && mins < 390); // 02:00 ~ 06:30

    if(isOverlappingBusySlot(input.value, currentApptBusySlots)){
      hint.textContent = "📅 이미 다른 일정과 겹치는 시간이에요. 다른 시간을 골라주세요.";
    }else if(isSleepTime){
      hint.textContent = "😴 이 시간엔 최한민이 자고 있을 확률이 높아요. 답장이 늦을 수 있어요.";
    }else{
      hint.textContent = "";
    }
  }

  async function submitAppointment(type){
    // 보안 규칙이 email == 로그인 계정 을 요구하므로 입력값 대신 Auth 계정을 사용
    const email = getCurrentMemberEmail();
    if(!email){ showToast("로그인 후 이용할 수 있어요"); return; }
    const applicant = document.getElementById('apptApplicant').value.trim();
    const companion = document.getElementById('apptCompanion').value.trim();
    const datetime = document.getElementById('apptDatetime').value;

    if(!isAllowedEmail(email)){
      showToast("gmail.com / naver.com / kakao.com 주소만 사용할 수 있어요");
      return;
    }
    if(type === '게임 약속' && selectedGames.size === 0){
      showToast("게임을 하나 이상 선택해주세요");
      return;
    }
    if(!applicant || !companion || !datetime){
      showToast("신청자, 동행자, 날짜/시간을 모두 입력해주세요");
      return;
    }
    if(!canSendNow()){
      showToast("너무 빨리 재전송하려고 해요! 1분 후 다시 시도해주세요");
      return;
    }
    if(isOverlappingBusySlot(datetime, currentApptBusySlots)){
      showToast("이미 잡힌 시간대예요. 다른 시간을 선택해주세요");
      return;
    }

    const submitBtn = document.getElementById('apptSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = "전송 중...";

    const gameLine = type === '게임 약속' ? ("\n선택한 게임: " + Array.from(selectedGames).join(", ")) : "";
    const formattedDatetime = formatDatetime(datetime);

    try{
      await sendEmail({
        to_email: "rokafhanmin@gmail.com",
        reply_to: email,
        category: "약속 신청 - " + type,
        title: type + " 신청",
        message: "보내는 사람: " + email + gameLine + "\n약속 신청자: " + applicant + "\n동행자: " + companion + "\n날짜 및 시간: " + formattedDatetime
      });
      recordSendTime();
      closeSheet();
      showToast("전송 되었습니다");
      playSuccessAnimation();
      sendConfirmationEmail(
        email,
        "약속 신청이 접수되었습니다",
        applicant + "님, " + type + " 신청이 정상적으로 접수되었습니다.\n신청하신 날짜/시간: " + formattedDatetime + "\n최한민이 확인 후 답변드릴게요."
      );
      showAddToCalendar(type + " (" + applicant + ")", datetime);
      logToSheet({
        type: "약속",
        category: type,
        email: email,
        applicant: applicant,
        companion: companion,
        datetime: formattedDatetime,
        games: type === '게임 약속' ? Array.from(selectedGames).join(", ") : "",
        sentAt: new Date().toISOString()
      });
      saveToFirestore('appointments', {
        appointmentType: type,
        email: email,
        applicant: applicant,
        companion: companion,
        datetime: datetime,
        datetimeDisplay: formattedDatetime,
        games: type === '게임 약속' ? Array.from(selectedGames).join(", ") : ""
      });
    }catch(err){
      showToast("전송 실패하였습니다");
      submitBtn.disabled = false;
      submitBtn.textContent = "신청 보내기";
    }
  }

  function personaChoice(type){
    closeSheet();
    if(type === 'good'){
      showToast("역시 자네는 내 친구가 맞아. 어서 이 서비스를 정상적으로 이용해주게😊");
    }else{
      showToast("자네는 날 실망시켰네. 나는 몹시 삐쳐있어. 냉큼 이 서비스에서 나가시게");
      setTimeout(showErrorScreen, 3000);
    }
  }

  function showErrorScreen(){
    document.getElementById('errorScreen').classList.add('show');
  }

  function hideErrorScreen(){
    document.getElementById('errorScreen').classList.remove('show');
  }

  async function submitInquiry(){
    const email = getCurrentMemberEmail();
    if(!email){ showToast("로그인 후 이용할 수 있어요"); return; }
    const title = document.getElementById('inquiryTitle').value.trim();
    const body = document.getElementById('inquiryBody').value.trim();

    if(!isAllowedEmail(email)){
      showToast("gmail.com / naver.com / kakao.com 주소만 사용할 수 있어요");
      return;
    }
    if(!title || !body || !selectedTag){
      showToast("제목, 내용, 분류를 모두 입력해주세요");
      return;
    }
    if(!canSendNow()){
      showToast("너무 빨리 재전송하려고 해요! 1분 후 다시 시도해주세요");
      return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = "전송 중...";

    try{
      await sendEmail({
        to_email: "rokafhanmin@gmail.com",
        reply_to: email,
        category: selectedTag,
        title: title,
        message: "보내는 사람: " + email + (selectedRelation ? " (" + selectedRelation + ")" : "") + "\n\n" + body
      });
      recordSendTime();
      closeSheet();
      showToast("전송 되었습니다");
      playSuccessAnimation();
      sendConfirmationEmail(
        email,
        "[접수 성공] 문의가 접수되었습니다",
        "안녕하세요. \"최한민에게 무엇을 요청하시겠어요\" 문의 서비스입니다.\n보내주신 문의 \"" + title + "\"" + pickParticle(title, "이", "가") + " 정상적으로 접수되었습니다. 제가 확인 후 최대한 빨리 답변드릴게요. 감사합니다."
      );
      logToSheet({
        type: "문의",
        category: selectedTag,
        relation: selectedRelation || "",
        email: email,
        title: title,
        body: body,
        sentAt: new Date().toISOString()
      });
      saveToFirestore('inquiries', {
        category: selectedTag,
        relation: selectedRelation || "",
        email: email,
        title: title,
        body: body
      });
    }catch(err){
      showToast("전송 실패하였습니다");
      submitBtn.disabled = false;
      submitBtn.textContent = "전송";
    }
  }
