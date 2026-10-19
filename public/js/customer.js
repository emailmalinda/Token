// Customer Mobile App — Socket.IO Logic
const socket = io();

// ── State ──────────────────────────────────────────────────────────────
let myToken       = null;
let myType        = null;
let isGenerating  = false;

// ── DOM refs ───────────────────────────────────────────────────────────
const screenChoose   = document.getElementById('screen-choose');
const screenWaiting  = document.getElementById('screen-waiting');
const calledOverlay  = document.getElementById('called-overlay');
const mobBtnJr       = document.getElementById('mob-btn-jr');
const mobBtnCl       = document.getElementById('mob-btn-cl');
const mobTokenType   = document.getElementById('mob-token-type');
const mobTokenNumber = document.getElementById('mob-token-number');
const mobTokenTime   = document.getElementById('mob-token-time');
const calledTokenNum = document.getElementById('called-token-num');
const calledCounterNum = document.getElementById('called-counter-num');
const btnDismiss     = document.getElementById('btn-dismiss-called');
const btnGetNew      = document.getElementById('btn-get-new-token');

// ── Screen switcher ────────────────────────────────────────────────────
function showScreen(id) {
  [screenChoose, screenWaiting].forEach(s => s.classList.remove('active'));
  if (id === 'choose')  screenChoose.classList.add('active');
  if (id === 'waiting') screenWaiting.classList.add('active');
  calledOverlay.classList.remove('show');
}

// ── Audio: Notification chime ──────────────────────────────────────────
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playCalledChime() {
  initAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6

  notes.forEach((freq, i) => {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + i * 0.18);
    gain.gain.setValueAtTime(0, now + i * 0.18);
    gain.gain.linearRampToValueAtTime(0.25, now + i * 0.18 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now + i * 0.18);
    osc.stop(now + i * 0.18 + 0.55);
  });

  // Also play a second round (stronger)
  setTimeout(() => {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    notes.forEach((freq, i) => {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.18);
      gain.gain.setValueAtTime(0, t + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.35, t + i * 0.18 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t + i * 0.18);
      osc.stop(t + i * 0.18 + 0.65);
    });
  }, 900);
}

// ── Vibration ──────────────────────────────────────────────────────────
function vibrate() {
  if (navigator.vibrate) {
    navigator.vibrate([300, 100, 300, 100, 500]);
  }
}

// ── Token generation ───────────────────────────────────────────────────
function requestToken(type, label) {
  if (isGenerating) return;
  isGenerating = true;

  // Unlock audio on user gesture
  initAudio();

  myType = type;
  socket.emit('generate-token', type);

  // Optimistic UI: show waiting screen immediately
  mobTokenType.textContent   = label.toUpperCase();
  mobTokenNumber.textContent = '...';
  mobTokenTime.textContent   = 'Issuing token...';
  showScreen('waiting');
}

mobBtnJr.addEventListener('click', () => requestToken('JR', 'Job Request'));
mobBtnCl.addEventListener('click', () => requestToken('CL', 'Collection'));

// ── Server: token generated ────────────────────────────────────────────
socket.on('token-generated', (tokenNum) => {
  // Only handle if this is the token we requested
  if (!myType) return;

  myToken = tokenNum;
  isGenerating = false;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  mobTokenType.textContent   = myType === 'JR' ? 'JOB REQUEST' : 'COLLECTION';
  mobTokenNumber.textContent = tokenNum;
  mobTokenTime.textContent   = `Issued at ${timeStr}`;

  showScreen('waiting');
});

// ── Server: your token is being called! ───────────────────────────────
socket.on('your-token-called', (data) => {
  const { token, counter } = data;

  calledTokenNum.textContent   = token;
  calledCounterNum.textContent = `Please go to Counter ${counter}`;

  // Show overlay
  calledOverlay.classList.add('show');

  // Sound + vibrate
  playCalledChime();
  vibrate();

  // Try browser notification too (if permission granted)
  if (Notification.permission === 'granted') {
    new Notification('🔔 Your Token is Being Called!', {
      body: `${token} → Please proceed to Counter ${counter}`,
      icon: '/favicon.ico'
    });
  }
});

// ── Dismiss called overlay ─────────────────────────────────────────────
btnDismiss.addEventListener('click', () => {
  calledOverlay.classList.remove('show');
  // Reset and go back to choose screen after a moment
  setTimeout(() => {
    myToken = null;
    myType  = null;
    showScreen('choose');
  }, 300);
});

// ── Get new token ─────────────────────────────────────────────────────
btnGetNew.addEventListener('click', () => {
  myToken = null;
  myType  = null;
  isGenerating = false;
  calledOverlay.classList.remove('show');
  showScreen('choose');
});

// ── Request browser notification permission ───────────────────────────
if ('Notification' in window && Notification.permission === 'default') {
  // Ask after a short delay so it doesn't feel intrusive
  setTimeout(() => {
    Notification.requestPermission();
  }, 2000);
}

// ── Error handler ──────────────────────────────────────────────────────
socket.on('error-msg', (msg) => {
  isGenerating = false;
  showScreen('choose');
  alert(`Error: ${msg}`);
});
