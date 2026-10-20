# 🎫 INVO Token System

A **real-time queue token management system** built with **Node.js**, **Express**, and **Socket.IO**. Customers receive a numbered token and an optional **WhatsApp notification** when their token is called at the counter — no app install required.

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎟️ Token Generation | Two queues: **Job Request (JR)** and **Collection (CL)** |
| 🖥️ Live Display Board | Real-time token call announcements on a big screen |
| 📟 Counter Interface | Staff call, recall, or complete tokens per counter |
| 📱 Customer Mobile View | Customers track their token from their phone via QR |
| 💬 WhatsApp Notifications | Auto-message sent to customer when token is called |
| 🔄 Auto Daily Reset | Queues reset automatically at midnight |
| 💾 Persistent State | Queue state saved to `db.json` and survives restarts |

---

## 🗂️ Project Structure

```
invo-token-system/
├── public/
│   ├── kiosk.html       # Token generation kiosk (touch screen)
│   ├── display.html     # Main display board
│   ├── counter.html     # Staff counter interface
│   ├── customer.html    # Customer mobile tracking page
│   ├── qr.html          # QR code page linking to customer view
│   ├── css/             # Stylesheets
│   └── js/              # Client-side scripts
├── server.js            # Main Node.js server
├── db.json              # Runtime state (auto-generated, gitignored)
├── .env.example         # Environment variable template
├── package.json
└── .gitignore
```

---

## 🚀 Getting Started (Local)

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/invo-token-system.git
cd invo-token-system
```

### 2. Install dependencies

```bash
npm install
```

> ⚠️ This project uses `whatsapp-web.js` which downloads Chromium via Puppeteer on first install. This may take a few minutes.

### 3. Configure environment variables

Copy the example env file and edit as needed:

```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

The only variable required locally is:

```env
PORT=3000
```

### 4. Run the server

```bash
npm start
```

The server will start and print:

```
=========================================
 Akan Token System is Live on Port 3000
 Local: http://localhost:3000
=========================================
```

### 5. Open the pages

| Page | URL |
|---|---|
| Kiosk (token generation) | http://localhost:3000/kiosk |
| Display Board | http://localhost:3000/display |
| Counter (staff) | http://localhost:3000/counter |
| Customer Mobile | http://localhost:3000/customer |
| QR Code page | http://localhost:3000/qr |

---

## 💬 WhatsApp Setup

On first run, the server will print a **QR code** in the terminal. Scan it with WhatsApp:

```
WhatsApp → Settings → Linked Devices → Link a Device
```

Once linked, the session is saved in `.wwebjs_auth/` (gitignored) and persists across restarts. You only need to scan once.

> ⚠️ **Render.com Note:** WhatsApp Web requires a persistent filesystem for session storage (`.wwebjs_auth/`). Render's free tier uses an **ephemeral filesystem** — the session will be lost on each restart. Use a [Render Disk](https://render.com/docs/disks) or a persistent volume for production deployments.

---

## ☁️ Deploy to Render.com

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Create a new Web Service on Render

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect your GitHub repository
3. Set the following:

| Setting | Value |
|---|---|
| **Environment** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

### 3. Environment Variables on Render

Render automatically sets `PORT` for you — your `server.js` already reads `process.env.PORT`, so no extra config is needed.

If you add more secrets in the future (API keys, etc.), add them in:
**Render Dashboard → Your Service → Environment → Add Environment Variable**

> ✅ Never commit `.env` to GitHub. Use `.env.example` as a template.

---

## 🛠️ Development Mode

Use Node's built-in file watcher (Node.js v18+) for auto-restart on file changes:

```bash
npm run dev
```

---

## 📋 Socket.IO Events Reference

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `generate-token` | `"JR"` \| `"CL"` | Generate a new token |
| `call-next` | `{ counter, type }` | Call next token at a counter |
| `recall-current` | `counter` | Recall the current token |
| `complete-current` | `counter` | Mark current token as served |
| `call-specific` | `{ token, counter }` | Call a specific token number |
| `send-sms` | `{ phone, token, type }` | Send WhatsApp notification |
| `manual-reset` | _(none)_ | Reset all queues |
| `clear-history` | _(none)_ | Clear call history log |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `init-state` | `state` | Full state on connection |
| `state-updated` | `state` | Broadcast after any change |
| `token-generated` | `tokenNumber` | Confirmation to kiosk |
| `token-called` | `{ token, counter }` | Broadcast to display |
| `your-token-called` | `{ token, counter }` | Direct notification to customer |
| `sms-sent` | `{ phone, token }` | WhatsApp send success |
| `sms-failed` | `{ phone, error }` | WhatsApp send failure |
| `queue-empty` | `{ counter, type }` | No tokens left in queue |
| `system-reset-alert` | _(none)_ | System was reset |

---

## 📄 License

ISC © INVO
