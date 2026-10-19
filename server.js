const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

// ── WhatsApp Client Setup ─────────────────────────────────────────────
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let waClient = null;
let waReady = false;

function initWhatsApp() {
  waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
    }
  });

  waClient.on('qr', (qr) => {
    console.log('\n========================================');
    console.log(' INVO WhatsApp — Scan this QR to link');
    console.log('========================================');
    qrcode.generate(qr, { small: true });
    console.log('Open WhatsApp → Linked Devices → Link a Device\n');
  });

  waClient.on('ready', () => {
    waReady = true;
    console.log('✅ WhatsApp Client is Ready!');
  });

  waClient.on('auth_failure', (msg) => {
    waReady = false;
    console.error('❌ WhatsApp Auth Failed:', msg);
  });

  waClient.on('disconnected', (reason) => {
    waReady = false;
    console.warn('⚠️  WhatsApp Disconnected:', reason);
    // Auto-reconnect after 10 seconds
    setTimeout(initWhatsApp, 10000);
  });

  waClient.initialize().catch(err => {
    console.error('WhatsApp init error:', err.message);
  });
}

initWhatsApp();
// ─────────────────────────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Token → Socket mapping for customer mobile notifications
// When a customer phone generates a token, we remember their socket ID
// so we can send a direct notification when their token is called.
const tokenSocketMap = {};

const PORT = process.env.PORT || 3000;
const STATE_FILE = path.join(__dirname, 'db.json');

// Initial state structure
let state = {
  date: new Date().toISOString().slice(0, 10),
  jrNext: 1,
  clNext: 1,
  jrQueue: [],
  clQueue: [],
  activeCalls: {
    "1": null,
    "2": null,
    "3": null,
    "4": null
  },
  history: []
};

// Load state from db.json if exists
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      const loaded = JSON.parse(data);
      if (loaded.date) {
        state = { ...state, ...loaded };
      }
    }
  } catch (err) {
    console.error("Error loading state file:", err);
  }
}

// Save state to db.json
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error("Error saving state file:", err);
  }
}

// Check if the day has changed to reset counters
function checkDailyReset() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.date !== today) {
    console.log(`Date changed from ${state.date} to ${today}. Resetting queues.`);
    state.date = today;
    state.jrNext = 1;
    state.clNext = 1;
    state.jrQueue = [];
    state.clQueue = [];
    state.activeCalls = {
      "1": null,
      "2": null,
      "3": null,
      "4": null
    };
    state.history = [];
    saveState();
    return true;
  }
  return false;
}

// Helper to format token number (e.g. 5 -> "005")
function formatNumber(num) {
  return String(num).padStart(3, '0');
}

// Init State
loadState();
checkDailyReset();

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/kiosk',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'kiosk.html')));
app.get('/display',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'display.html')));
app.get('/counter',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'counter.html')));
app.get('/customer', (req, res) => res.sendFile(path.join(__dirname, 'public', 'customer.html')));
app.get('/qr',       (req, res) => res.sendFile(path.join(__dirname, 'public', 'qr.html')));

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  checkDailyReset();
  socket.emit('init-state', state);

  // Generate a new token
  socket.on('generate-token', (type) => {
    checkDailyReset();
    
    if (type !== 'JR' && type !== 'CL') {
      return socket.emit('error-msg', 'Invalid token type');
    }

    let tokenNum;
    if (type === 'JR') {
      tokenNum = `JR-${formatNumber(state.jrNext)}`;
      state.jrQueue.push(tokenNum);
      state.jrNext++;
      if (state.jrNext > 1000) state.jrNext = 1;
    } else {
      tokenNum = `CL-${formatNumber(state.clNext)}`;
      state.clQueue.push(tokenNum);
      state.clNext++;
      if (state.clNext > 1000) state.clNext = 1;
    }

    saveState();
    // Register this socket as the owner of this token (for mobile notification)
    tokenSocketMap[tokenNum] = socket.id;
    socket.emit('token-generated', tokenNum);
    io.emit('state-updated', state);
  });

  // Call the next token
  socket.on('call-next', (data) => {
    checkDailyReset();
    const { counter, type } = data;

    if (!state.activeCalls.hasOwnProperty(counter)) {
      return socket.emit('error-msg', 'Invalid counter number');
    }

    let queue = type === 'JR' ? state.jrQueue : state.clQueue;

    if (queue.length === 0) {
      return socket.emit('queue-empty', { counter, type });
    }

    const token = queue.shift();
    const timeStr = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    
    state.activeCalls[counter] = { token, time: timeStr };
    state.history.unshift({ token, counter, time: timeStr });
    if (state.history.length > 5) {
      state.history.pop();
    }

    saveState();
    io.emit('token-called', { token, counter });
    io.emit('state-updated', state);

    // Notify the customer's phone directly
    const customerSid = tokenSocketMap[token];
    if (customerSid) {
      io.to(customerSid).emit('your-token-called', { token, counter });
      delete tokenSocketMap[token];
    }
  });

  // Recall current token
  socket.on('recall-current', (counter) => {
    checkDailyReset();
    const active = state.activeCalls[counter];
    if (active) {
      io.emit('token-called', { token: active.token, counter, recall: true });
      // Re-notify customer phone on recall too
      const customerSid = tokenSocketMap[active.token];
      if (customerSid) {
        io.to(customerSid).emit('your-token-called', { token: active.token, counter });
      }
    } else {
      socket.emit('error-msg', 'No active token to recall');
    }
  });

  // Complete current token
  socket.on('complete-current', (counter) => {
    checkDailyReset();
    if (state.activeCalls[counter]) {
      state.activeCalls[counter] = null;
      saveState();
      io.emit('state-updated', state);
    } else {
      socket.emit('error-msg', 'No active token to complete');
    }
  });

  // Call specific token
  socket.on('call-specific', (data) => {
    checkDailyReset();
    const { token, counter } = data;

    if (!state.activeCalls.hasOwnProperty(counter)) {
      return socket.emit('error-msg', 'Invalid counter number');
    }

    const type = token.startsWith('JR') ? 'JR' : 'CL';
    
    if (type === 'JR') {
      const idx = state.jrQueue.indexOf(token);
      if (idx !== -1) {
        state.jrQueue.splice(idx, 1);
      } else {
        return socket.emit('error-msg', 'Token not found in Job Request queue');
      }
    } else {
      const idx = state.clQueue.indexOf(token);
      if (idx !== -1) {
        state.clQueue.splice(idx, 1);
      } else {
        return socket.emit('error-msg', 'Token not found in Collection queue');
      }
    }

    const timeStr = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    
    state.activeCalls[counter] = { token, time: timeStr };
    state.history.unshift({ token, counter, time: timeStr });
    if (state.history.length > 5) {
      state.history.pop();
    }

    saveState();
    io.emit('token-called', { token, counter });
    io.emit('state-updated', state);

    // Notify the customer's phone directly
    const customerSid = tokenSocketMap[token];
    if (customerSid) {
      io.to(customerSid).emit('your-token-called', { token, counter });
      delete tokenSocketMap[token];
    }
  });


  // Reset entire system
  socket.on('manual-reset', () => {
    console.log("Manual queue reset requested");
    state.jrNext = 1;
    state.clNext = 1;
    state.jrQueue = [];
    state.clQueue = [];
    state.activeCalls = {
      "1": null,
      "2": null,
      "3": null,
      "4": null
    };
    state.history = [];
    state.date = new Date().toISOString().slice(0, 10);
    
    saveState();
    io.emit('state-updated', state);
    io.emit('system-reset-alert');
  });

  // Clear history only
  socket.on('clear-history', () => {
    console.log("Manual history log clear requested");
    state.history = [];
    saveState();
    io.emit('state-updated', state);
  });

  // ── WhatsApp Notification ─────────────────────────────────────────────
  // Triggered by kiosk when customer opts in to receive a WhatsApp message.
  // ─────────────────────────────────────────────────────────────────────
  socket.on('send-sms', async (data) => {
    const { phone, token, type } = data;

    // Validate: must be 10 digits starting with 07
    if (!phone || !/^07\d{8}$/.test(phone)) {
      return socket.emit('sms-failed', { phone, error: 'Invalid phone number format' });
    }

    // Convert local 07XXXXXXXX → WhatsApp international format 94XXXXXXXX@c.us
    const waNumber = '94' + phone.slice(1) + '@c.us';
    const message  = `🎫 *INVO Token System*\n\nYour *${type}* token number is:\n\n*${token}*\n\nPlease proceed to the waiting area and watch the main display screen.\n\n_Thank you for your patience!_ 🙏`;

    console.log(`📲 WhatsApp Request → ${phone} (${waNumber}) | Token: ${token}`);

    if (!waReady || !waClient) {
      console.warn('⚠️  WhatsApp not ready — message not sent');
      return socket.emit('sms-failed', { phone, error: 'WhatsApp not connected. Please scan the QR code on the server.' });
    }

    try {
      await waClient.sendMessage(waNumber, message);
      socket.emit('sms-sent', { phone, token });
      console.log(`✅ WhatsApp sent to ${phone}`);
    } catch (err) {
      console.error(`❌ WhatsApp send failed for ${phone}:`, err.message);
      socket.emit('sms-failed', { phone, error: err.message });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    // Clean up any token mappings for this socket
    for (const [token, sid] of Object.entries(tokenSocketMap)) {
      if (sid === socket.id) delete tokenSocketMap[token];
    }
  });
});

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` Abans Token System is Live on Port ${PORT}`);
  console.log(` Local: http://localhost:${PORT}`);
  console.log(`=========================================`);
});