# VuSync ![alt text](https://github.com/leThrax/VuSync/blob/master/client/src/assets/VuSync-logo.png "VuSync Logo")


A self-hosted, real-time YouTube synchronizer. Create a room, share the link, and watch videos together perfectly in sync — no accounts, no ads, no third-party servers.

---

## Features

### Sync
- Frame-accurate playback sync across all viewers — play, pause, and seek are broadcast instantly via WebSockets
- Drift-compensated join: new viewers catch up to the exact playback position, accounting for the time elapsed since the host last sent a state update
- Viewer controls are locked out by default; non-hosts snap back to the room position if they try to seek

### Rooms
- **Instant rooms** — one click to create, a short room code to share
- **Shareable URLs** — joining via `?room=<code>` auto-joins on load, no extra step
- **Password protection** — host can set, change, or remove a room password at any time; guests see a password prompt when joining
- **Delegated control** — the host can grant any guest full playback and queue control
- **Kick** — host can remove any viewer from the room

### Queue
- Add videos to the front or back of the queue
- **Playlist import** — paste a YouTube playlist URL to enqueue all videos at once (first video loads immediately; the rest are queued)
- Drag-and-drop reordering
- Play any queue item immediately
- Remove individual items
- Shuffle (Fisher-Yates)
- Skip to next / Clear all
- **Loop mode** — loops the current video indefinitely; synced across all users

### Player
- Resizable embedded YouTube player (drag the right edge); size persists across page reloads
- Configurable default video displayed before any video is loaded
- Gradient placeholder when no default video is set

### UX
- Persistent username (saved in `localStorage`)
- Toast notifications for join, leave, kick, room code copy, and queue actions
- Room code one-click copy to clipboard

### Server
- Optional YouTube Data API v3 key for unlimited playlist pagination (50 videos per page, all pages fetched)
- Automatic fallback to YouTube's public RSS feed when no API key is configured (up to 15 videos per playlist)
- Video availability validated server-side before any URL is loaded or queued
- API key is never exposed to clients

---

## Tech stack

| Layer    | Technology                                       |
|----------|--------------------------------------------------|
| Frontend | React 19, Vite, TypeScript, react-youtube        |
| Backend  | Node.js, Express, Socket.IO                      |
| Shared   | TypeScript (npm workspace, compiled to CommonJS) |
| Realtime | Socket.IO (WebSockets with long-poll fallback)   |

---

## Requirements

- **Node.js** 18 or later
- **npm** 9 or later (ships with Node 18)
- A **YouTube Data API v3 key** *(optional — only needed for full playlist support beyond 15 videos)*

---

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/your-username/vusync.git
cd vusync
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure

Copy the example config and edit it:

```bash
cp vusync.config.example.json vusync.config.json
```

```json
{
  "server": {
    "port": 3001
  },
  "client": {
    "port": 5173
  },
  "youtube": {
    "apiKey": ""
  },
  "defaultVideoId": ""
}
```

| Field            | Description                                                              |
|------------------|--------------------------------------------------------------------------|
| `server.port`    | Port the backend listens on (default `3001`)                             |
| `client.port`    | Port Vite's dev server uses (default `5173`)                             |
| `youtube.apiKey` | YouTube Data API v3 key — leave empty to use the RSS fallback            |
| `defaultVideoId` | YouTube video ID shown before any video is loaded (leave empty for none) |

**Getting a YouTube Data API v3 key** *(optional)*
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable **YouTube Data API v3**
3. Create an API key under *Credentials*
4. Paste the key into `vusync.config.json`

### 4. Run in development

```bash
npm run dev
```

Starts both the backend (port 3001) and the Vite dev server (port 5173) concurrently with hot-reload.

Open `http://localhost:5173` in your browser.

### 5. Build for production

```bash
npm run build
npm start
```

This compiles all packages and starts the server with `NODE_ENV=production`. The server serves the built React app on port 3001 and handles the API and WebSocket on the same port — no separate static file server needed.

For HTTPS (required for `wss://` WebSockets in production) put a reverse proxy in front of port 3001.

---

## Production deployment

VuSync runs as a single Node.js process. Point your reverse proxy at `localhost:3001`.

### Caddy *(recommended — automatic HTTPS)*

`/etc/caddy/Caddyfile`:
```
example.com {
    reverse_proxy localhost:3001
}
```

Caddy obtains and renews a Let's Encrypt certificate automatically. That's all the config required.

### Apache2

Enable the required modules once:
```bash
sudo a2enmod proxy proxy_http proxy_wstunnel ssl rewrite
```

Create `/etc/apache2/sites-available/vusync.conf`:
```apache
<VirtualHost *:80>
    ServerName example.com
    Redirect permanent / https://example.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName example.com
    SSLEngine on
    # certbot --apache fills these in automatically
    # SSLCertificateFile    /etc/letsencrypt/live/example.com/fullchain.pem
    # SSLCertificateKeyFile /etc/letsencrypt/live/example.com/privkey.pem

    ProxyPreserveHost On

    # WebSocket upgrade — required for Socket.IO
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) ws://localhost:3001/$1 [P,L]

    ProxyPass / http://localhost:3001/
    ProxyPassReverse / http://localhost:3001/
</VirtualHost>
```

```bash
sudo a2ensite vusync
sudo certbot --apache -d example.com
sudo systemctl reload apache2
```

### Running as a service (systemd)

`/etc/systemd/system/vusync.service`:
```ini
[Unit]
Description=VuSync
After=network.target

[Service]
WorkingDirectory=/path/to/vusync
ExecStart=/usr/bin/node server/dist/index.js
Environment=NODE_ENV=production
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now vusync
```

---

## Usage

1. Open VuSync in your browser and set a display name.
2. Click **Create room** — your room URL is ready to share instantly.
3. Paste a YouTube video or playlist URL and click **Load**.
4. Guests open the shared URL and the video plays in sync automatically.
5. The host can grant control to any guest, set a password, or kick users from the Users panel.

---

## Potential future features

Ideas being considered — contributions welcome:

- **Chat panel** — real-time text chat alongside the player (Socket.IO event already wired)
- **Mobile layout** — responsive design for phones and tablets
- **Volume sync** — optional opt-in to synchronize volume level across viewers
- **Watch history** — per-room log of previously played videos with one-click re-queue
- **Room persistence** — survive server restarts by persisting room state to disk or Redis
- **Docker image** — official `docker-compose.yml` for one-command self-hosting
- **Invite link generator** — copyable URL pre-filled with room code

---

## License

MIT
