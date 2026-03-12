import type { Room, User, QueueItem } from '../../../shared/types'

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0d0d0f;color:#ddd;min-height:100vh;font-size:14px;line-height:1.5}
a{color:#3d8ef0;text-decoration:none}
a:hover{text-decoration:underline}
.nav{background:#14162a;border-bottom:1px solid rgba(61,142,240,0.16);padding:0 24px;height:48px;display:flex;align-items:center;gap:20px;box-shadow:0 2px 12px rgba(0,0,0,0.4)}
.nav-brand{font-weight:700;color:#fff;font-size:15px;letter-spacing:-0.01em;margin-right:8px}
.nav-brand span{color:#3d8ef0}
.nav-link{color:#666;font-size:13px;transition:color 0.1s}
.nav-link:hover{color:#fff;text-decoration:none}
.nav-spacer{flex:1}
.nav-logout{background:none;border:1px solid rgba(255,255,255,0.1);color:#666;cursor:pointer;font-size:12px;padding:4px 10px;border-radius:5px;transition:border-color 0.1s,color 0.1s}
.nav-logout:hover{border-color:rgba(255,255,255,0.25);color:#ddd}
main{max-width:960px;margin:0 auto;padding:32px 24px}
h1{font-size:20px;font-weight:700;color:#fff;margin-bottom:4px}
.page-sub{font-size:13px;color:#555;margin-bottom:28px}
.card{background:#14162a;border:1px solid rgba(61,142,240,0.16);border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,0.4);padding:20px;margin-bottom:20px}
.card-title{font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-bottom:28px}
.stat{background:#14162a;border:1px solid rgba(61,142,240,0.16);border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,0.4);padding:20px 24px}
.stat-value{font-size:30px;font-weight:700;color:#3d8ef0;line-height:1}
.stat-label{font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em;margin-top:6px}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.08);white-space:nowrap}
td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;vertical-align:middle}
tr:last-child td{border-bottom:none}
tbody tr:hover td{background:rgba(255,255,255,0.02)}
.badge{display:inline-flex;align-items:center;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:600}
.badge-yes{background:rgba(62,201,122,0.12);color:#3ec97a;border:1px solid rgba(62,201,122,0.25)}
.badge-no{background:rgba(255,255,255,0.05);color:#444;border:1px solid rgba(255,255,255,0.08)}
.badge-host{background:rgba(232,160,32,0.13);color:#e8a020;border:1px solid rgba(232,160,32,0.25)}
.badge-ctrl{background:rgba(139,124,248,0.12);color:#8b7cf8;border:1px solid rgba(139,124,248,0.25)}
.badge-playing{background:rgba(62,201,122,0.12);color:#3ec97a;border:1px solid rgba(62,201,122,0.25)}
.badge-paused{background:rgba(255,255,255,0.05);color:#555;border:1px solid rgba(255,255,255,0.08)}
.mono{font-family:monospace;font-size:12px;color:#aaa}
.btn{display:inline-flex;align-items:center;justify-content:center;border:none;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;padding:5px 12px;transition:background 0.1s,color 0.1s;text-decoration:none}
.btn:hover{text-decoration:none}
.btn-primary{background:#3d8ef0;color:#fff}
.btn-primary:hover{background:#1a6fd4}
.btn-danger{background:none;border:1px solid #f05050;color:#f05050}
.btn-danger:hover{background:rgba(240,80,80,0.13)}
.btn-warn{background:none;border:1px solid rgba(232,160,32,0.5);color:#e8a020}
.btn-warn:hover{background:rgba(232,160,32,0.1)}
.btn-ghost{background:none;border:1px solid rgba(255,255,255,0.1);color:#888}
.btn-ghost:hover{border-color:rgba(255,255,255,0.25);color:#ddd}
.btn-sm{font-size:11px;padding:3px 8px}
.actions{display:flex;gap:6px;align-items:center}
.empty{font-size:13px;color:#3a3a4a;text-align:center;padding:24px}
.back{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#555;margin-bottom:20px;transition:color 0.1s}
.back:hover{color:#ddd;text-decoration:none}
.kv{display:grid;grid-template-columns:160px 1fr;gap:8px 16px;font-size:13px}
.kv-label{color:#555;font-size:12px;padding-top:1px}
.kv-value{color:#ddd}
.section-gap{margin-top:24px}
.uptime{font-variant-numeric:tabular-nums}
/* Login */
.login-wrap{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.login-card{background:#14162a;border:1px solid rgba(61,142,240,0.16);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.6);padding:36px 32px;width:100%;max-width:360px}
.login-title{font-size:18px;font-weight:700;color:#fff;margin-bottom:4px}
.login-sub{font-size:13px;color:#555;margin-bottom:28px}
.form-group{margin-bottom:16px}
.form-label{display:block;font-size:11px;color:#555;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px}
.form-input{width:100%;padding:8px 10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:#fff;font-size:13px;outline:none;transition:border-color 0.15s}
.form-input:focus{border-color:rgba(61,142,240,0.5)}
.form-input::placeholder{color:#333}
.form-error{background:rgba(240,80,80,0.1);border:1px solid rgba(240,80,80,0.3);color:#f47070;border-radius:6px;padding:8px 12px;font-size:13px;margin-bottom:16px}
.btn-block{width:100%;padding:9px}
`

function e(str: string | number): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function layout(title: string, content: string, showNav = true): string {
    const nav = showNav ? `
<nav class="nav">
  <span class="nav-brand">Vu<span>Sync</span> Admin</span>
  <a href="/admin" class="nav-link">Dashboard</a>
  <a href="/admin/rooms" class="nav-link">Rooms</a>
  <a href="/admin/config" class="nav-link">Config</a>
  <div class="nav-spacer"></div>
  <form method="POST" action="/admin/logout" style="display:inline">
    <button type="submit" class="nav-logout">Log out</button>
  </form>
</nav>` : ''

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${e(title)} — VuSync Admin</title>
<style>${CSS}</style>
</head>
<body>
${nav}
<main>${content}</main>
</body>
</html>`
}

function formatUptime(ms: number): string {
    const s = Math.floor(ms / 1000)
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    const parts = []
    if (d > 0) parts.push(`${d}d`)
    if (h > 0) parts.push(`${h}h`)
    parts.push(`${m}m`)
    return parts.join(' ')
}

export function renderLogin(opts?: { error?: string }): string {
    const error = opts?.error
        ? `<div class="form-error">${e(opts.error)}</div>`
        : ''

    const content = `
<div class="login-wrap">
  <div class="login-card">
    <div class="login-title">Admin Login</div>
    <div class="login-sub">VuSync server administration</div>
    ${error}
    <form method="POST" action="/admin/login">
      <div class="form-group">
        <label class="form-label" for="username">Username</label>
        <input class="form-input" type="text" id="username" name="username" autocomplete="username" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="password">Password</label>
        <input class="form-input" type="password" id="password" name="password" autocomplete="current-password" required>
      </div>
      <button type="submit" class="btn btn-primary btn-block">Sign in</button>
    </form>
  </div>
</div>`

    return layout('Login', content, false)
}

export function renderDashboard(opts: { rooms: number; users: number; startTime: number }): string {
    const content = `
<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px">
  <h1>Dashboard</h1>
  <button class="btn btn-primary" id="dash-reload-btn" onclick="reloadCounts()" style="font-size:18px;padding:6px 14px;line-height:1">↻</button>
</div>
<p class="page-sub">VuSync server status</p>

<div class="stats">
  <div class="stat">
    <div class="stat-value" id="stat-rooms">${e(opts.rooms)}</div>
    <div class="stat-label">Active Rooms</div>
  </div>
  <div class="stat">
    <div class="stat-value" id="stat-users">${e(opts.users)}</div>
    <div class="stat-label">Connected Users</div>
  </div>
  <div class="stat">
    <div class="stat-value uptime" id="stat-uptime">—</div>
    <div class="stat-label">Server Uptime</div>
  </div>
  <div class="stat">
    <div class="stat-value" id="stat-ram">— <span style="font-size:16px;color:#8b7cf8">MB</span></div>
    <div class="stat-label">RAM Usage</div>
  </div>
  <div class="stat">
    <div class="stat-value" id="stat-cpu">—<span style="font-size:16px;color:#8b7cf8">%</span></div>
    <div class="stat-label">CPU Usage</div>
  </div>
</div>

<div class="card">
  <div class="card-title">Quick actions</div>
  <div class="actions">
    <a href="/admin/rooms" class="btn btn-primary">View all rooms</a>
    <a href="/admin/config" class="btn btn-ghost">View config</a>
  </div>
</div>

<script>
function fmtUptime(ms) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  const parts = []
  if (d > 0) parts.push(d + 'd')
  if (h > 0) parts.push(h + 'h')
  parts.push(m + 'm')
  return parts.join(' ')
}
async function pollStats() {
  try {
    const r = await fetch('/admin/api/stats')
    if (!r.ok) return
    const d = await r.json()
    document.getElementById('stat-uptime').textContent = fmtUptime(d.uptimeMs)
    document.getElementById('stat-ram').innerHTML = d.ramMb + ' <span style="font-size:16px;color:#8b7cf8">MB</span>'
    document.getElementById('stat-cpu').innerHTML = d.cpuPercent + '<span style="font-size:16px;color:#8b7cf8">%</span>'
  } catch {}
}
pollStats()
setInterval(pollStats, 3000)

async function reloadCounts() {
  const btn = document.getElementById('dash-reload-btn')
  btn.textContent = '↻'
  btn.disabled = true
  try {
    const r = await fetch('/admin/api/rooms')
    if (!r.ok) return
    const d = await r.json()
    document.getElementById('stat-rooms').textContent = d.rooms.length
    document.getElementById('stat-users').textContent = d.totalUsers
  } catch {} finally {
    btn.textContent = '↻'
    btn.disabled = false
  }
}
</script>`

    return layout('Dashboard', content)
}

export function renderRoomList(roomList: Room[]): string {
    const rows = roomList.length === 0
        ? `<tr><td colspan="6" class="empty">No active rooms</td></tr>`
        : roomList.map(r => `
<tr>
  <td><a href="/admin/rooms/${e(r.id)}" class="mono">${e(r.id)}</a></td>
  <td>${e(r.name)}</td>
  <td>${e(r.users.length)}</td>
  <td><span class="mono">${e(r.playerState.videoId || '—')}</span></td>
  <td>${e(r.queue.length)}</td>
  <td>${r.hasPassword
        ? '<span class="badge badge-yes">Yes</span>'
        : '<span class="badge badge-no">No</span>'}</td>
  <td>
    <div class="actions">
      <a href="/admin/rooms/${e(r.id)}" class="btn btn-ghost btn-sm">Detail</a>
      <form method="POST" action="/admin/rooms/${e(r.id)}/close" style="display:inline" onsubmit="return confirm('Close room ${e(r.name)}? All users will be disconnected.')">
        <button type="submit" class="btn btn-danger btn-sm">Close</button>
      </form>
    </div>
  </td>
</tr>`).join('')

    const content = `
<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px">
  <h1>Rooms</h1>
  <button class="btn btn-primary" id="rooms-reload-btn" onclick="reloadRooms()" style="font-size:18px;padding:6px 14px;line-height:1">↻</button>
</div>
<p class="page-sub" id="rooms-sub">${roomList.length} active room${roomList.length !== 1 ? 's' : ''}</p>

<div class="card">
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Users</th>
        <th>Video</th>
        <th>Queue</th>
        <th>Password</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody id="rooms-tbody">${rows}</tbody>
  </table>
</div>

<script>
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
async function reloadRooms() {
  const btn = document.getElementById('rooms-reload-btn')
  btn.textContent = '↻'
  btn.disabled = true
  try {
    const r = await fetch('/admin/api/rooms')
    if (!r.ok) return
    const d = await r.json()
    const sub = document.getElementById('rooms-sub')
    sub.textContent = d.rooms.length + ' active room' + (d.rooms.length !== 1 ? 's' : '')
    document.getElementById('rooms-tbody').innerHTML = d.rooms.length === 0
      ? '<tr><td colspan="7" class="empty">No active rooms</td></tr>'
      : d.rooms.map(r => \`<tr>
  <td><a href="/admin/rooms/\${esc(r.id)}" class="mono">\${esc(r.id)}</a></td>
  <td>\${esc(r.name)}</td>
  <td>\${r.userCount}</td>
  <td><span class="mono">\${esc(r.videoId || '—')}</span></td>
  <td>\${r.queueLength}</td>
  <td>\${r.hasPassword ? '<span class="badge badge-yes">Yes</span>' : '<span class="badge badge-no">No</span>'}</td>
  <td><div class="actions">
    <a href="/admin/rooms/\${esc(r.id)}" class="btn btn-ghost btn-sm">Detail</a>
    <form method="POST" action="/admin/rooms/\${esc(r.id)}/close" style="display:inline" onsubmit="return confirm('Close room \${esc(r.name)}? All users will be disconnected.')">
      <button type="submit" class="btn btn-danger btn-sm">Close</button>
    </form>
  </div></td>
</tr>\`).join('')
  } catch {} finally {
    btn.textContent = '↻'
    btn.disabled = false
  }
}
</script>`

    return layout('Rooms', content)
}

export function renderRoomDetail(room: Room): string {
    const ps = room.playerState
    const effectiveTime = ps.currentTime + (ps.isPlaying ? (Date.now() - ps.lastUpdated) / 1000 : 0)
    const playingBadge = ps.isPlaying
        ? '<span class="badge badge-playing">Playing</span>'
        : '<span class="badge badge-paused">Paused</span>'

    const userRows = room.users.map((u: User) => {
        const isHost = u.id === room.hostId
        const roleBadges = [
            isHost ? '<span class="badge badge-host">Host</span>' : '',
            !isHost && u.canControl ? '<span class="badge badge-ctrl">Control</span>' : '',
        ].filter(Boolean).join(' ')
        return `
<tr>
  <td>${e(u.name)}</td>
  <td><span class="mono">${e(u.id)}</span></td>
  <td>${roleBadges || '<span style="color:#444">—</span>'}</td>
  <td>${!isHost
        ? `<form method="POST" action="/admin/rooms/${e(room.id)}/kick/${e(u.id)}" style="display:inline" onsubmit="return confirm('Kick ${e(u.name)}?')"><button type="submit" class="btn btn-danger btn-sm">Kick</button></form>`
        : '<span style="color:#444">—</span>'}</td>
</tr>`
    }).join('')

    const queueBody = room.queue.length === 0
        ? '<tr><td colspan="3" class="empty">Queue is empty</td></tr>'
        : room.queue.map((item: QueueItem, i: number) => `
<tr>
  <td style="color:#555;width:32px">${i + 1}</td>
  <td>${e(item.title)}</td>
  <td><span class="mono">${e(item.videoId)}</span></td>
</tr>`).join('')

    const content = `
<a href="/admin/rooms" class="back">← Back to rooms</a>

<div id="closed-banner" style="display:none;background:rgba(240,80,80,0.1);border:1px solid rgba(240,80,80,0.3);color:#f47070;border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:13px">
  Room has been closed. <a href="/admin/rooms" style="color:#f47070;text-decoration:underline">Back to room list</a>
</div>

<h1>${e(room.name)}</h1>
<p class="page-sub">Room ID: <span class="mono">${e(room.id)}</span></p>

<div class="card">
  <div class="card-title">Player state</div>
  <div class="kv" id="player-kv">
    <span class="kv-label">Status</span><span class="kv-value" id="player-status">${playingBadge}</span>
    <span class="kv-label">Video ID</span><span class="kv-value mono" id="player-video">${e(ps.videoId || '—')}</span>
    <span class="kv-label">Current time</span><span class="kv-value" id="player-time">${effectiveTime.toFixed(1)}s</span>
  </div>
  <div class="section-gap">
    <div class="actions">
      <span id="player-pause-wrap">${ps.isPlaying
        ? `<form method="POST" action="/admin/rooms/${e(room.id)}/pause" style="display:inline"><button type="submit" class="btn btn-warn">Force pause</button></form>`
        : '<span style="color:#444;font-size:13px">Playback already paused</span>'}</span>
      <form method="POST" action="/admin/rooms/${e(room.id)}/close" style="display:inline" onsubmit="return confirm('Close room ${e(room.name)}? All users will be disconnected.')">
        <button type="submit" class="btn btn-danger">Close room</button>
      </form>
    </div>
  </div>
</div>

<div class="card">
  <div class="card-title">Users (<span id="users-count">${room.users.length}</span>)</div>
  <table>
    <thead><tr><th>Name</th><th>Socket ID</th><th>Role</th><th>Action</th></tr></thead>
    <tbody id="users-body">${userRows}</tbody>
  </table>
</div>

<div class="card">
  <div class="card-title">Queue (<span id="queue-count">${room.queue.length}</span>)</div>
  <table>
    <thead><tr><th>#</th><th>Title</th><th>Video ID</th></tr></thead>
    <tbody id="queue-body">${queueBody}</tbody>
  </table>
</div>

<script>
const ROOM_ID = ${JSON.stringify(room.id)}
const HOST_ID_INIT = ${JSON.stringify(room.hostId)}
let hostId = HOST_ID_INIT

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function renderPlayerStatus(ps) {
  const effectiveTime = ps.currentTime + (ps.isPlaying ? (Date.now() - ps.lastUpdated) / 1000 : 0)
  document.getElementById('player-status').innerHTML = ps.isPlaying
    ? '<span class="badge badge-playing">Playing</span>'
    : '<span class="badge badge-paused">Paused</span>'
  document.getElementById('player-video').textContent = ps.videoId || '—'
  document.getElementById('player-time').textContent = effectiveTime.toFixed(1) + 's'
  document.getElementById('player-pause-wrap').innerHTML = ps.isPlaying
    ? \`<form method="POST" action="/admin/rooms/\${esc(ROOM_ID)}/pause" style="display:inline"><button type="submit" class="btn btn-warn">Force pause</button></form>\`
    : '<span style="color:#444;font-size:13px">Playback already paused</span>'
}

function renderUsers(users) {
  hostId = users.find(u => u.id === hostId)?.id ?? (users[0]?.id ?? hostId)
  document.getElementById('users-count').textContent = users.length
  document.getElementById('users-body').innerHTML = users.map(u => {
    const isHost = u.id === hostId
    const badges = [
      isHost ? '<span class="badge badge-host">Host</span>' : '',
      !isHost && u.canControl ? '<span class="badge badge-ctrl">Control</span>' : '',
    ].filter(Boolean).join(' ')
    const action = isHost
      ? '<span style="color:#444">—</span>'
      : \`<form method="POST" action="/admin/rooms/\${esc(ROOM_ID)}/kick/\${esc(u.id)}" style="display:inline" onsubmit="return confirm('Kick \${esc(u.name)}?')"><button type="submit" class="btn btn-danger btn-sm">Kick</button></form>\`
    return \`<tr>
  <td>\${esc(u.name)}</td>
  <td><span class="mono">\${esc(u.id)}</span></td>
  <td>\${badges || '<span style="color:#444">—</span>'}</td>
  <td>\${action}</td>
</tr>\`
  }).join('')
}

function renderQueue(queue) {
  document.getElementById('queue-count').textContent = queue.length
  document.getElementById('queue-body').innerHTML = queue.length === 0
    ? '<tr><td colspan="3" class="empty">Queue is empty</td></tr>'
    : queue.map((item, i) => \`<tr>
  <td style="color:#555;width:32px">\${i + 1}</td>
  <td>\${esc(item.title)}</td>
  <td><span class="mono">\${esc(item.videoId)}</span></td>
</tr>\`).join('')
}

let timer
async function poll() {
  try {
    const r = await fetch('/admin/api/rooms/' + ROOM_ID)
    if (r.status === 404) {
      document.getElementById('closed-banner').style.display = 'block'
      clearInterval(timer)
      return
    }
    if (!r.ok) return
    const room = await r.json()
    hostId = room.hostId
    renderPlayerStatus(room.playerState)
    renderUsers(room.users)
    renderQueue(room.queue)
  } catch {}
}

poll()
timer = setInterval(poll, 2000)
</script>`

    return layout(`Room: ${room.name}`, content)
}

export function renderConfig(cfg: Record<string, unknown>): string {
    const json = JSON.stringify(cfg, null, 2)

    const content = `
<h1>Config</h1>
<p class="page-sub">Active server configuration (read-only — edit vusync.config.json to change)</p>

<div class="card">
  <pre style="font-family:monospace;font-size:13px;color:#aaa;white-space:pre-wrap;word-break:break-all">${e(json)}</pre>
</div>`

    return layout('Config', content)
}
