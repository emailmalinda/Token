const socket = io();

let selectedCounter = sessionStorage.getItem('selectedCounter') || null;

// Clock
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

// DOM Elements - Navigation & Session
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const adminView = document.getElementById('admin-view');
const sessionInfo = document.getElementById('session-info');
const counterLabel = document.getElementById('counter-label');
const btnLogout = document.getElementById('btn-logout');

// DOM Elements - Login View
const btnLoginSubmit = document.getElementById('btn-login-submit');
const selectBtns = document.querySelectorAll('.counter-select-btn');
const passwordGroup = document.getElementById('password-group');
const adminPasswordInput = document.getElementById('admin-password');
const passwordError = document.getElementById('password-error');

// DOM Elements - Operator Dashboard Metrics & Panels
const jrWaitingCount = document.getElementById('jr-waiting-count');
const clWaitingCount = document.getElementById('cl-waiting-count');
const activeTokenDisplay = document.getElementById('active-token-display');
const jrQueueList = document.getElementById('jr-queue-list');
const clQueueList = document.getElementById('cl-queue-list');

// DOM Elements - Operator Control Buttons
const btnCallJr = document.getElementById('btn-call-jr');
const btnCallCl = document.getElementById('btn-call-cl');
const btnRecall = document.getElementById('btn-recall');
const btnComplete = document.getElementById('btn-complete');

// DOM Elements - Admin Dashboard
const adminJrWaitingCount = document.getElementById('admin-jr-waiting-count');
const adminClWaitingCount = document.getElementById('admin-cl-waiting-count');
const btnAdminGenJr = document.getElementById('btn-admin-gen-jr');
const btnAdminGenCl = document.getElementById('btn-admin-gen-cl');
const btnAdminClearHistory = document.getElementById('btn-admin-clear-history');
const btnAdminResetSystem = document.getElementById('btn-admin-reset-system');
const adminWorkstationList = document.getElementById('admin-workstation-list');

// DOM Elements - Call Specific Modal
const callSpecificModal = document.getElementById('call-specific-modal');
const callSpecificTokenLabel = document.getElementById('call-specific-token-label');
const btnCallSpecificCancel = document.getElementById('btn-call-specific-cancel');
const callSpecificCounterBtns = document.querySelectorAll('.call-specific-counter-btn');

// DOM Elements - Reset Modal
const resetModal = document.getElementById('reset-modal');
const btnResetCancel = document.getElementById('btn-reset-cancel');
const btnResetConfirm = document.getElementById('btn-reset-confirm');

// ---------------------------------------------------------
// Login & View Management
// ---------------------------------------------------------
selectBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    selectBtns.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedCounter = btn.getAttribute('data-counter');
    btnLoginSubmit.removeAttribute('disabled');

    // Toggle password fields for Admin
    if (selectedCounter === 'admin') {
      passwordGroup.style.display = 'block';
      adminPasswordInput.focus();
    } else {
      passwordGroup.style.display = 'none';
      passwordError.style.display = 'none';
      adminPasswordInput.value = '';
    }
  });
});

btnLoginSubmit.addEventListener('click', () => {
  if (!selectedCounter) return;

  if (selectedCounter === 'admin') {
    const password = adminPasswordInput.value;
    if (password === 'admin123' || password === 'admin') {
      passwordError.style.display = 'none';
      sessionStorage.setItem('selectedCounter', 'admin');
      enterDashboard();
    } else {
      passwordError.style.display = 'block';
      adminPasswordInput.select();
    }
  } else {
    sessionStorage.setItem('selectedCounter', selectedCounter);
    enterDashboard();
  }
});

// Support enter key in password input
adminPasswordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    btnLoginSubmit.click();
  }
});

btnLogout.addEventListener('click', () => {
  sessionStorage.removeItem('selectedCounter');
  selectedCounter = null;
  
  // Reset fields
  selectBtns.forEach(b => b.classList.remove('selected'));
  btnLoginSubmit.setAttribute('disabled', true);
  passwordGroup.style.display = 'none';
  passwordError.style.display = 'none';
  adminPasswordInput.value = '';
  
  // Show login screen
  loginView.style.display = 'flex';
  dashboardView.style.display = 'none';
  adminView.style.display = 'none';
  sessionInfo.style.display = 'none';
});

function enterDashboard() {
  loginView.style.display = 'none';
  sessionInfo.style.display = 'flex';
  
  if (selectedCounter === 'admin') {
    adminView.style.display = 'grid';
    dashboardView.style.display = 'none';
    counterLabel.textContent = `Admin Terminal`;
  } else {
    dashboardView.style.display = 'grid';
    adminView.style.display = 'none';
    counterLabel.textContent = `Counter ${selectedCounter}`;
  }
  
  // Request fresh state
  socket.emit('init-state', (state) => {
    renderDashboard(state);
  });
}

// Check if already logged in previously
if (selectedCounter) {
  enterDashboard();
}

// ---------------------------------------------------------
// Real-time rendering
// ---------------------------------------------------------
function renderDashboard(state) {
  if (!selectedCounter) return;

  if (selectedCounter === 'admin') {
    // ---------------------------------------------------------
    // Render ADMIN Dashboard View
    // ---------------------------------------------------------
    adminJrWaitingCount.textContent = state.jrQueue.length;
    adminClWaitingCount.textContent = state.clQueue.length;

    // Render workstations live board
    adminWorkstationList.innerHTML = ["1", "2", "3", "4"].map(cNum => {
      const active = state.activeCalls[cNum];
      if (active) {
        return `
          <div class="history-item glass-panel" style="padding: 1rem 1.25rem; border-left: 5px solid var(--accent-cyan); background: rgba(0, 242, 254, 0.02);">
            <div style="font-weight: 700; font-size: 1.1rem; font-family: monospace; color: var(--accent-cyan);">${active.token}</div>
            <div class="history-counter-info" style="align-items: flex-end;">
              <div style="font-size: 0.95rem; font-weight: 600; color: #fff;">Counter ${cNum}</div>
              <div style="font-size: 0.75rem; color: var(--text-secondary);">Serving since ${active.time}</div>
            </div>
          </div>`;
      } else {
        return `
          <div class="history-item glass-panel" style="padding: 1rem 1.25rem; opacity: 0.45; border-left: 5px solid transparent; background: rgba(255, 255, 255, 0.01);">
            <div style="font-weight: 500; font-size: 0.95rem; color: var(--text-muted);">FREE</div>
            <div class="history-counter-info" style="align-items: flex-end;">
              <div style="font-size: 0.95rem; font-weight: 600; color: var(--text-muted);">Counter ${cNum}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Workstation Idle</div>
            </div>
          </div>`;
      }
    }).join('');

    // Render clickable lineups in Admin Dashboard
    const adminJrQueueList = document.getElementById('admin-jr-queue-list');
    const adminClQueueList = document.getElementById('admin-cl-queue-list');

    if (state.jrQueue.length === 0) {
      adminJrQueueList.innerHTML = `<span class="queue-empty-text">No tokens waiting</span>`;
    } else {
      adminJrQueueList.innerHTML = state.jrQueue.map(tok => `
        <span class="queue-token-pill admin-clickable-pill" style="cursor: pointer; border-color: rgba(0, 242, 254, 0.25);" data-token="${tok}">${tok}</span>
      `).join('');
    }

    if (state.clQueue.length === 0) {
      adminClQueueList.innerHTML = `<span class="queue-empty-text">No tokens waiting</span>`;
    } else {
      adminClQueueList.innerHTML = state.clQueue.map(tok => `
        <span class="queue-token-pill admin-clickable-pill" style="cursor: pointer; border-color: rgba(16, 185, 129, 0.25);" data-token="${tok}">${tok}</span>
      `).join('');
    }

    // Attach click triggers to pills
    document.querySelectorAll('.admin-clickable-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        const token = e.target.getAttribute('data-token');
        openCallSpecificModal(token);
      });
    });

  } else {
    // ---------------------------------------------------------
    // Render OPERATOR Dashboard View
    // ---------------------------------------------------------
    
    // 1. Update active queues sizes
    jrWaitingCount.textContent = state.jrQueue.length;
    clWaitingCount.textContent = state.clQueue.length;

    // 2. Disable Call Buttons if queues are empty
    if (state.jrQueue.length === 0) {
      btnCallJr.setAttribute('disabled', true);
    } else {
      btnCallJr.removeAttribute('disabled');
    }

    if (state.clQueue.length === 0) {
      btnCallCl.setAttribute('disabled', true);
    } else {
      btnCallCl.removeAttribute('disabled');
    }

    // 3. Update Currently Serving Token
    const myActiveCall = state.activeCalls[selectedCounter];
    if (myActiveCall) {
      activeTokenDisplay.textContent = myActiveCall.token;
      activeTokenDisplay.classList.remove('empty');
      
      // Enable Recall and Complete
      btnRecall.removeAttribute('disabled');
      btnComplete.removeAttribute('disabled');
    } else {
      activeTokenDisplay.textContent = 'NO ACTIVE CALL';
      activeTokenDisplay.classList.add('empty');
      
      // Disable Recall and Complete
      btnRecall.setAttribute('disabled', true);
      btnComplete.setAttribute('disabled', true);
    }

    // 4. Update Waiting Lineup Playlists (first 6 tokens)
    if (state.jrQueue.length === 0) {
      jrQueueList.innerHTML = `<span class="queue-empty-text">No tokens waiting</span>`;
    } else {
      jrQueueList.innerHTML = state.jrQueue.slice(0, 6).map(tok => `
        <span class="queue-token-pill">${tok}</span>
      `).join('') + (state.jrQueue.length > 6 ? `<span style="font-size: 0.85rem; color: var(--text-muted);">+${state.jrQueue.length - 6} more</span>` : '');
    }

    if (state.clQueue.length === 0) {
      clQueueList.innerHTML = `<span class="queue-empty-text">No tokens waiting</span>`;
    } else {
      clQueueList.innerHTML = state.clQueue.slice(0, 6).map(tok => `
        <span class="queue-token-pill">${tok}</span>
      `).join('') + (state.clQueue.length > 6 ? `<span style="font-size: 0.85rem; color: var(--text-muted);">+${state.clQueue.length - 6} more</span>` : '');
    }
  }
}

// ---------------------------------------------------------
// Control Actions & Socket Event Emits (Operator Dashboard)
// ---------------------------------------------------------
btnCallJr.addEventListener('click', () => {
  if (!selectedCounter) return;
  socket.emit('call-next', { counter: selectedCounter, type: 'JR' });
});

btnCallCl.addEventListener('click', () => {
  if (!selectedCounter) return;
  socket.emit('call-next', { counter: selectedCounter, type: 'CL' });
});

btnRecall.addEventListener('click', () => {
  if (!selectedCounter) return;
  socket.emit('recall-current', selectedCounter);
});

btnComplete.addEventListener('click', () => {
  if (!selectedCounter) return;
  socket.emit('complete-current', selectedCounter);
});

// ---------------------------------------------------------
// Administrative Control Actions (Admin Dashboard)
// ---------------------------------------------------------
btnAdminGenJr.addEventListener('click', () => {
  socket.emit('generate-token', 'JR');
});

btnAdminGenCl.addEventListener('click', () => {
  socket.emit('generate-token', 'CL');
});

btnAdminClearHistory.addEventListener('click', () => {
  if (confirm("Are you sure you want to clear recent called token logs from the display screen? (This does not affect waiting queues)")) {
    socket.emit('clear-history');
  }
});

btnAdminResetSystem.addEventListener('click', () => {
  resetModal.style.display = 'flex';
});

// Reset Modal Handlers
btnResetCancel.addEventListener('click', () => {
  resetModal.style.display = 'none';
});

btnResetConfirm.addEventListener('click', () => {
  socket.emit('manual-reset');
  resetModal.style.display = 'none';
});

// Call Specific Token Modal Handlers
let targetTokenToCall = null;

function openCallSpecificModal(token) {
  targetTokenToCall = token;
  callSpecificTokenLabel.textContent = token;
  callSpecificModal.style.display = 'flex';
}

btnCallSpecificCancel.addEventListener('click', () => {
  callSpecificModal.style.display = 'none';
  targetTokenToCall = null;
});

callSpecificCounterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const counterNum = btn.getAttribute('data-counter');
    if (targetTokenToCall && counterNum) {
      socket.emit('call-specific', { token: targetTokenToCall, counter: counterNum });
      callSpecificModal.style.display = 'none';
      targetTokenToCall = null;
    }
  });
});

// ---------------------------------------------------------
// Server Events listeners
// ---------------------------------------------------------
socket.on('init-state', (state) => {
  renderDashboard(state);
});

socket.on('state-updated', (state) => {
  renderDashboard(state);
});

socket.on('queue-empty', (data) => {
  alert(`Queue for ${data.type === 'JR' ? 'Job Requests' : 'Collections'} is empty!`);
});

socket.on('token-generated', (tokenNum) => {
  // If the admin is the one who generated the token, notify them
  if (selectedCounter === 'admin') {
    alert(`Token ${tokenNum} generated successfully.`);
  }
});

socket.on('error-msg', (msg) => {
  alert(`Error: ${msg}`);
});
