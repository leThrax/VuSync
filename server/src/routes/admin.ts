import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { rooms, getIo, removeFromRoom } from '../socket/handlers'
import { EVENTS } from '../../../shared/constants'
import { renderDashboard, renderRoomList, renderRoomDetail, renderLogin, renderConfig } from '../admin/ui'
import type { VuSyncConfig } from '../config'

declare module 'express-session' {
    interface SessionData {
        adminAuthenticated?: boolean
    }
}

export function createAdminRouter(config: VuSyncConfig, startTime: number) {
    const router = Router()

    // ── Dashboard ──────────────────────────────────────────────────────────
    router.get('/', (_req, res) => {
        const totalUsers = [...rooms.values()].reduce((n, r) => n + r.users.length, 0)
        res.send(renderDashboard({ rooms: rooms.size, users: totalUsers, startTime }))
    })

    // ── Live stats (polled by dashboard JS) ────────────────────────────────
    router.get('/api/stats', async (_req, res) => {
        const ramMb = Math.round(process.memoryUsage().rss / 1024 / 1024)
        const cpuBefore = process.cpuUsage()
        await new Promise(r => setTimeout(r, 100))
        const delta = process.cpuUsage(cpuBefore)
        const cpuPercent = Math.round((delta.user + delta.system) / (100 * 1000) * 100)
        res.json({ uptimeMs: Date.now() - startTime, ramMb, cpuPercent })
    })

    // ── Login (network-accessible mode only) ───────────────────────────────
    router.get('/login', (req, res) => {
        if (req.session.adminAuthenticated) {
            res.redirect('/admin')
            return
        }
        res.send(renderLogin())
    })

    router.post('/login', async (req, res) => {
        const { username, password } = req.body as { username?: string; password?: string }
        const validUser = username === config.admin.username
        const validPass = config.admin.passwordHash && password
            ? await bcrypt.compare(password, config.admin.passwordHash)
            : false
        if (validUser && validPass) {
            req.session.adminAuthenticated = true
            res.redirect('/admin')
        } else {
            res.send(renderLogin({ error: 'Invalid username or password.' }))
        }
    })

    router.post('/logout', (req, res) => {
        req.session.destroy(() => {
            res.redirect('/admin/login')
        })
    })

    // ── Config viewer ──────────────────────────────────────────────────────
    router.get('/config', (_req, res) => {
        const safe = {
            server: config.server,
            client: config.client,
            youtube: { apiKey: config.youtube.apiKey ? '(set)' : '(not set)' },
            defaultVideoId: config.defaultVideoId,
            admin: {
                enabled: config.admin.enabled,
                networkAccessible: config.admin.networkAccessible,
                username: config.admin.username,
                passwordHash: config.admin.passwordHash ? '(set)' : '(not set)',
            },
        }
        res.send(renderConfig(safe as Record<string, unknown>))
    })

    // ── Room list ──────────────────────────────────────────────────────────
    router.get('/rooms', (_req, res) => {
        res.send(renderRoomList([...rooms.values()]))
    })

    // ── Room detail ────────────────────────────────────────────────────────
    router.get('/rooms/:id', (req, res) => {
        const room = rooms.get(req.params.id)
        if (!room) {
            res.status(404).send('Room not found.')
            return
        }
        res.send(renderRoomDetail(room))
    })

    // ── Rooms summary JSON (used by dashboard + rooms list reload buttons) ──
    router.get('/api/rooms', (_req, res) => {
        const list = [...rooms.values()].map(r => ({
            id: r.id, name: r.name, userCount: r.users.length,
            videoId: r.playerState.videoId, queueLength: r.queue.length,
            hasPassword: !!r.hasPassword,
        }))
        res.json({ rooms: list, totalUsers: list.reduce((n, r) => n + r.userCount, 0) })
    })

    // ── Room JSON (polled by room detail page) ─────────────────────────────
    router.get('/api/rooms/:id', (req, res) => {
        const room = rooms.get(req.params.id)
        if (!room) { res.status(404).json({ error: 'not found' }); return }
        res.json(room)
    })

    // ── Force pause ────────────────────────────────────────────────────────
    router.post('/rooms/:id/pause', (req, res) => {
        const room = rooms.get(req.params.id)
        const io = getIo()
        if (!room || !io) {
            res.status(404).send('Room not found.')
            return
        }
        const ps = room.playerState
        const effectiveTime = ps.currentTime + (ps.isPlaying ? (Date.now() - ps.lastUpdated) / 1000 : 0)
        room.playerState = { ...ps, isPlaying: false, currentTime: effectiveTime, lastUpdated: Date.now() }
        io.to(room.id).emit(EVENTS.PAUSE, room.playerState)
        res.redirect(`/admin/rooms/${room.id}`)
    })

    // ── Kick user ──────────────────────────────────────────────────────────
    router.post('/rooms/:id/kick/:socketId', (req, res) => {
        const room = rooms.get(req.params.id)
        const io = getIo()
        if (!room || !io) {
            res.status(404).send('Room not found.')
            return
        }
        io.sockets.sockets.get(req.params.socketId)?.emit(EVENTS.KICKED)
        removeFromRoom(req.params.socketId)
        res.redirect(`/admin/rooms/${req.params.id}`)
    })

    // ── Close room ─────────────────────────────────────────────────────────
    router.post('/rooms/:id/close', (req, res) => {
        const room = rooms.get(req.params.id)
        const io = getIo()
        if (!room || !io) {
            res.status(404).send('Room not found.')
            return
        }
        // Copy array before iterating — removeFromRoom mutates room.users on each call
        for (const user of [...room.users]) {
            io.sockets.sockets.get(user.id)?.emit(EVENTS.KICKED)
            removeFromRoom(user.id)
        }
        res.redirect('/admin/rooms')
    })

    return router
}
