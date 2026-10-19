// Customer Kiosk Logic
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

// Sound Synthesis using Web Audio API
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playPrintSound() {
  initAudio();
  if (!audioCtx) return;

  const now = audioCtx.currentTime;

  // 1. Initial beep
  const oscBeep = audioCtx.createOscillator();
  const gainBeep = audioCtx.createGain();
  oscBeep.type = 'sine';
  oscBeep.frequency.setValueAtTime(1000, now);
  gainBeep.gain.setValueAtTime(0.06, now);
  gainBeep.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  
  oscBeep.connect(gainBeep);
  gainBeep.connect(audioCtx.destination);
  oscBeep.start(now);
  oscBeep.stop(now + 0.15);

  // 2. Printing motor whir and head movement (white noise + pitch modulation)
  const bufferSize = audioCtx.sampleRate * 1.8; // 1.8 seconds of printing
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noiseNode = audioCtx.createBufferSource();
  noiseNode.buffer = buffer;

  // Bandpass filter to make it sound like a small printer motor
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1200, now);
  filter.Q.setValueAtTime(1.5, now);

  // Modulate volume to simulate printing line-by-line (stutter)
  const motorGain = audioCtx.createGain();
  motorGain.gain.setValueAtTime(0.0, now);
  
  // Stuttering envelope
  const printDuration = 1.6;
  const steps = 15;
  for (let s = 0; s < steps; s++) {
    const stepTime = now + (s * (printDuration / steps)) + 0.1;
    motorGain.gain.setValueAtTime(0.06, stepTime);
    motorGain.gain.setValueAtTime(0.01, stepTime + 0.06);
  }
  motorGain.gain.exponentialRampToValueAtTime(0.0001, now + printDuration + 0.1);

  noiseNode.connect(filter);
  filter.connect(motorGain);
  motorGain.connect(audioCtx.destination);

  noiseNode.start(now + 0.05);
  noiseNode.stop(now + printDuration + 0.15);

  // 3. Cutter sound at the end
  const cutTime = now + printDuration + 0.15;
  const oscCut = audioCtx.createOscillator();
  const gainCut = audioCtx.createGain();
  
  oscCut.type = 'triangle';
  oscCut.frequency.setValueAtTime(150, cutTime);
  oscCut.frequency.linearRampToValueAtTime(80, cutTime + 0.08);
  
  gainCut.gain.setValueAtTime(0.12, cutTime);
  gainCut.gain.exponentialRampToValueAtTime(0.0001, cutTime + 0.08);

  oscCut.connect(gainCut);
  gainCut.connect(audioCtx.destination);
  oscCut.start(cutTime);
  oscCut.stop(cutTime + 0.1);
}

// ─────────────────────────────────────────
// SMS Phone Number Modal Logic
// ─────────────────────────────────────────

const smsPhoneModal   = document.getElementById('sms-phone-modal');
const smsPhoneInput   = document.getElementById('sms-phone-input');
const smsConfirmBtn   = document.getElementById('btn-sms-confirm');
const smsSkipBtn      = document.getElementById('btn-sms-skip');
const smsPhoneError   = document.getElementById('sms-phone-error');
const digitDots       = document.querySelectorAll('.digit-dot');

let pendingTokenType  = null;  // 'JR' or 'CL'
let pendingTokenLabel = null;
let isPrinting        = false;

// Update the digit-dot progress indicators
function updateDigitDots(count) {
  digitDots.forEach((dot, i) => {
    if (i < count) {
      dot.style.background = 'var(--accent-cyan)';
      dot.style.borderColor = 'var(--accent-cyan)';
      dot.style.boxShadow = '0 0 6px rgba(0,242,254,0.6)';
    } else {
      dot.style.background = 'rgba(255,255,255,0.15)';
      dot.style.borderColor = 'rgba(255,255,255,0.2)';
      dot.style.boxShadow = 'none';
    }
  });
}

// Phone input: only allow numeric digits, max 8
smsPhoneInput.addEventListener('input', (e) => {
  // Strip any non-digit characters
  let val = e.target.value.replace(/\D/g, '');
  if (val.length > 8) val = val.slice(0, 8);
  e.target.value = val;

  updateDigitDots(val.length);
  smsPhoneError.style.display = 'none';

  if (val.length === 8) {
    smsConfirmBtn.disabled = false;
    smsConfirmBtn.style.opacity = '1';
    smsConfirmBtn.style.pointerEvents = 'auto';
  } else {
    smsConfirmBtn.disabled = true;
    smsConfirmBtn.style.opacity = '0.5';
    smsConfirmBtn.style.pointerEvents = 'none';
  }
});

// Prevent non-numeric key presses
smsPhoneInput.addEventListener('keydown', (e) => {
  const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
  if (allowed.includes(e.key)) return;
  if (!/^\d$/.test(e.key)) {
    e.preventDefault();
  }
  // When 8 digits filled, pressing Enter triggers confirm
  if (e.key === 'Enter' && smsPhoneInput.value.length === 8) {
    smsConfirmBtn.click();
  }
});

// Open the SMS modal
function openSmsModal(type, label) {
  pendingTokenType  = type;
  pendingTokenLabel = label;

  // Reset modal state
  smsPhoneInput.value = '';
  smsPhoneError.style.display = 'none';
  smsConfirmBtn.disabled = true;
  smsConfirmBtn.style.opacity = '0.5';
  smsConfirmBtn.style.pointerEvents = 'none';
  updateDigitDots(0);

  smsPhoneModal.style.display = 'flex';

  // Focus input after a short delay (allow modal transition)
  setTimeout(() => smsPhoneInput.focus(), 150);
}

// Close SMS modal
function closeSmsModal() {
  smsPhoneModal.style.display = 'none';
  pendingTokenType  = null;
  pendingTokenLabel = null;
}

// Confirm: send SMS then get token
smsConfirmBtn.addEventListener('click', () => {
  const digits = smsPhoneInput.value.replace(/\D/g, '');
  if (digits.length !== 8) {
    smsPhoneError.style.display = 'block';
    smsPhoneInput.focus();
    return;
  }

  const type  = pendingTokenType;   // capture BEFORE closeSmsModal nulls them
  const label = pendingTokenLabel;
  const fullNumber = '07' + digits;
  closeSmsModal();
  triggerPrint(type, label, fullNumber);
});

// Skip: get token without SMS
smsSkipBtn.addEventListener('click', () => {
  const type  = pendingTokenType;
  const label = pendingTokenLabel;
  closeSmsModal();
  triggerPrint(type, label, null);
});

// ─────────────────────────────────────────
// Click Handlers
// ─────────────────────────────────────────

const btnJobRequest   = document.getElementById('btn-job-request');
const btnCollection   = document.getElementById('btn-collection');
const printerOverlay  = document.getElementById('printer-overlay');
const receiptTokenNum = document.getElementById('receipt-token-num');
const receiptTypeLabel= document.getElementById('receipt-type-label');
const receiptDate     = document.getElementById('receipt-date');
const receiptTime     = document.getElementById('receipt-time');

// Store phone number for SMS after token is generated
let pendingPhoneNumber = null;

function triggerPrint(type, label, phoneNumber) {
  if (isPrinting) return;
  isPrinting = true;

  // Initialize browser audio context on first user click
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  pendingPhoneNumber = phoneNumber;

  // Request token from server
  socket.emit('generate-token', type);

  // Local handler for receipt data mapping
  receiptTypeLabel.textContent = label;
}

if (btnJobRequest) {
  btnJobRequest.addEventListener('click', () => {
    if (isPrinting) return;
    initAudio();
    openSmsModal('JR', 'Job Request');
  });
}

if (btnCollection) {
  btnCollection.addEventListener('click', () => {
    if (isPrinting) return;
    initAudio();
    openSmsModal('CL', 'Collection');
  });
}

// ─────────────────────────────────────────
// Server Responses
// ─────────────────────────────────────────

// Server responds with new token
socket.on('token-generated', (tokenNum) => {
  receiptTokenNum.textContent = tokenNum;
  
  // Date and Time on receipt
  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  receiptDate.textContent = `Date: ${dateStr}`;
  receiptTime.textContent = `Time: ${timeStr}`;

  // Populate hidden print area for physical printer
  document.getElementById('print-token-num').textContent = tokenNum;
  document.getElementById('print-type-label').textContent = receiptTypeLabel.textContent.toUpperCase();
  document.getElementById('print-date').textContent = `Date: ${dateStr}`;
  document.getElementById('print-time').textContent = `Time: ${timeStr}`;

  // Send SMS request to server if phone number was provided
  if (pendingPhoneNumber) {
    socket.emit('send-sms', {
      phone: pendingPhoneNumber,
      token: tokenNum,
      type: receiptTypeLabel.textContent
    });
    pendingPhoneNumber = null;
  }

  // Show printer overlay
  printerOverlay.style.display = 'flex';

  // Play synthesized audio
  playPrintSound();

  // Trigger browser print dialog for physical ticket printing after a brief render delay
  setTimeout(() => {
    window.print();
  }, 400);

  // Reset printer after animation completes (3 seconds total)
  setTimeout(() => {
    printerOverlay.style.display = 'none';
    isPrinting = false;
  }, 3000);
});

socket.on('sms-sent', (data) => {
  console.log(`✅ SMS sent to ${data.phone} for token ${data.token}`);
});

socket.on('sms-failed', (data) => {
  console.warn(`⚠️ SMS failed for ${data.phone}: ${data.error}`);
});

socket.on('error-msg', (msg) => {
  alert(`Error: ${msg}`);
  isPrinting = false;
});
