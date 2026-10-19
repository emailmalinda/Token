const socket = io();

// Live Clock
function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: true 
  });
  const clockEl = document.getElementById('live-clock');
  if (clockEl) clockEl.textContent = timeStr;
}
setInterval(updateClock, 1000);
updateClock();

// Audio context and activation
let audioCtx = null;
let audioEnabled = false;

const audioOptIn = document.getElementById('audio-opt-in');
const btnActivateAudio = document.getElementById('btn-activate-audio');

btnActivateAudio.addEventListener('click', () => {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  audioEnabled = true;
  audioOptIn.style.display = 'none';
  console.log("Audio synthesized system initialized successfully.");
  
  // Test chime
  playChime();
});

// Synthesize a beautiful double-tone chime
function playChime() {
  if (!audioEnabled || !audioCtx) return;

  const now = audioCtx.currentTime;
  
  // Note 1: E5
  const osc1 = audioCtx.createOscillator();
  const gain1 = audioCtx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(659.25, now); // E5
  gain1.gain.setValueAtTime(0.08, now);
  gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
  osc1.connect(gain1);
  gain1.connect(audioCtx.destination);
  osc1.start(now);
  osc1.stop(now + 0.6);

  // Note 2: A5 (offset by 0.15s)
  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(880.00, now + 0.15); // A5
  gain2.gain.setValueAtTime(0.08, now + 0.15);
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
  osc2.connect(gain2);
  gain2.connect(audioCtx.destination);
  osc2.start(now + 0.15);
  osc2.stop(now + 0.85);
}

// Speak Token announcement
function speakToken(token, counter) {
  if (!audioEnabled || !window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Parse token parts (e.g. JR-005 -> "J R" and "0 0 5")
  const parts = token.split('-');
  const prefix = parts[0] === 'JR' ? 'J R' : 'C L';
  
  // Split digits of number (e.g. "005" -> "zero zero five" or digits)
  const numberStr = parts[1] || '';
  const digitWords = Array.from(numberStr).map(digit => {
    switch (digit) {
      case '0': return 'zero';
      case '1': return 'one';
      case '2': return 'two';
      case '3': return 'three';
      case '4': return 'four';
      case '5': return 'five';
      case '6': return 'six';
      case '7': return 'seven';
      case '8': return 'eight';
      case '9': return 'nine';
      default: return digit;
    }
  }).join(' ');

  const utteranceText = `Token ${prefix} ${digitWords}, please proceed to counter ${counter}`;
  const utterance = new SpeechSynthesisUtterance(utteranceText);
  
  // Set clean voice settings
  utterance.rate = 0.85; // slightly slower for clarity
  utterance.pitch = 1.05;
  
  // Try to find a nice female English voice
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(voice => 
    voice.lang.startsWith('en') && (voice.name.includes('Female') || voice.name.includes('Zira') || voice.name.includes('Google'))
  );
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  // Speak with small delay after chime
  setTimeout(() => {
    window.speechSynthesis.speak(utterance);
  }, 750);
}

// DOM Elements
const currentServingToken = document.getElementById('current-serving-token');
const currentServingCounter = document.getElementById('current-serving-counter');
const mainServingPanel = document.getElementById('main-serving-panel');
const historyList = document.getElementById('history-list');

// Render entire state
function renderState(state) {
  // Update sidebar title
  const sidebarTitle = document.querySelector('.sidebar-title');
  if (sidebarTitle) sidebarTitle.textContent = "Counter Workstations";

  // Find all active tokens
  const activeTokens = Object.values(state.activeCalls)
    .filter(c => c !== null)
    .map(c => c.token);

  // Find which is the latest active called token (first in history that is still active)
  let latestCall = null;
  if (state.history && state.history.length > 0) {
    for (let h of state.history) {
      if (activeTokens.includes(h.token)) {
        latestCall = h;
        break;
      }
    }
  }

  if (latestCall) {
    currentServingToken.textContent = latestCall.token;
    currentServingCounter.textContent = `Counter ${latestCall.counter}`;
    currentServingToken.style.fontSize = '8rem';
  } else {
    currentServingToken.textContent = 'WAITING';
    currentServingCounter.textContent = 'All tokens completed';
    currentServingToken.style.fontSize = '5rem';
  }

  // Render Counter Grid in sidebar (Counters 1 to 4)
  historyList.innerHTML = ["1", "2", "3", "4"].map(cNum => {
    const active = state.activeCalls[cNum];
    const isLatest = latestCall && latestCall.counter === cNum;
    
    if (active) {
      return `
        <div class="history-item glass-panel" style="border-left: 5px solid ${isLatest ? 'var(--accent-cyan)' : 'var(--accent-blue)'}; ${isLatest ? 'box-shadow: 0 0 15px rgba(0, 242, 254, 0.25); border-color: var(--accent-cyan);' : ''}">
          <div class="history-token">${active.token}</div>
          <div class="history-counter-info">
            <div class="history-counter" style="font-weight: 700; color: ${isLatest ? 'var(--accent-cyan)' : 'var(--text-primary)'}">Counter ${cNum}</div>
            <div class="history-time">${active.time}</div>
          </div>
        </div>`;
    } else {
      return `
        <div class="history-item glass-panel" style="opacity: 0.4; border-left: 5px solid transparent; background: rgba(255,255,255,0.01);">
          <div class="history-token" style="color: var(--text-muted); font-size: 1.25rem; font-family: sans-serif; font-weight: 500;">FREE</div>
          <div class="history-counter-info">
            <div class="history-counter" style="color: var(--text-muted);">Counter ${cNum}</div>
            <div class="history-time">Idle</div>
          </div>
        </div>`;
    }
  }).join('');
}

// Server updates
socket.on('init-state', (state) => {
  renderState(state);
});

socket.on('state-updated', (state) => {
  renderState(state);
});

socket.on('token-called', (data) => {
  const { token, counter } = data;

  // Set the text content immediately!
  currentServingToken.textContent = token;
  currentServingCounter.textContent = `Counter ${counter}`;
  currentServingToken.style.fontSize = '8rem';

  // Flash UI Alert (force restart animation by triggering reflow)
  mainServingPanel.classList.remove('new-call-alert');
  void mainServingPanel.offsetWidth; // Reflow
  mainServingPanel.classList.add('new-call-alert');
  
  // Remove flash animation after 4.5s
  setTimeout(() => {
    mainServingPanel.classList.remove('new-call-alert');
  }, 4500);

  // Play audio chime and speak
  if (audioEnabled) {
    playChime();
    speakToken(token, counter);
  }
});

socket.on('system-reset-alert', () => {
  currentServingToken.textContent = '----';
  currentServingCounter.textContent = 'System Reset';
  historyList.innerHTML = `
    <div class="empty-state">
      <p>System was reset by counter operator.</p>
    </div>`;
});

// Load voices when they are populated (necessary for Chrome/Android)
if (window.speechSynthesis) {
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {};
  }
}
