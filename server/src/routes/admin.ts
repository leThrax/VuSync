import { Router } from 'express'
import * as fs from 'fs'
import bcrypt from 'bcryptjs'
import { rooms, getIo, removeFromRoom, saveRooms } from '../socket/handlers'
import { EVENTS } from '../../../shared/constants'
import { renderDashboard, renderRoomList, renderRoomDetail, renderLogin, renderConfig, renderLogs } from '../admin/ui'
import type { VuSyncConfig } from '../config'
import { logger, getLogBuffer, getLogFilePath_export } from '../logger'

declare module 'express-session' {
    interface SessionData {
        adminAuthenticated?: boolean
    }
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 15 * 60 * 1000

// ── Stats history ──────────────────────────────────────────────────────────────
export interface StatPoint { ts: number; ram: number; cpu: number }
export const statsHistory: StatPoint[] = []
const MAX_HISTORY = 120

function startStatsCollector(): void {
    let prevCpu = process.cpuUsage()
    let prevTs = Date.now()
    let tickCount = 0

    setInterval(() => {
        const now = Date.now()
        const delta = process.cpuUsage(prevCpu)
        const elapsedUs = (now - prevTs) * 1000
        const cpuPercent = elapsedUs > 0 ? Math.min(100, Math.round((delta.user + delta.system) / elapsedUs * 100)) : 0
        prevCpu = process.cpuUsage()
        prevTs = now

        const ram = Math.round(process.memoryUsage().rss / 1024 / 1024)
        statsHistory.push({ ts: now, ram, cpu: cpuPercent })
        if (statsHistory.length > MAX_HISTORY) statsHistory.shift()

        tickCount++
        // Log stats every 60 ticks (~5 min at 5s interval)
        if (tickCount % 60 === 0) {
            logger.info(`Stats: RAM=${ram}MB CPU=${cpuPercent}%`)
        }
    }, 5000)
}

export function createAdminRouter(config: VuSyncConfig, startTime: number) {
    const router = Router()
    startStatsCollector()

    // ── Dashboard ──────────────────────────────────────────────────────────
    router.get('/', (_req, res) => {
        const totalUsers = [...rooms.values()].reduce((n, r) => n + r.users.length, 0)
        res.send(renderDashboard({ rooms: rooms.size, users: totalUsers, startTime }))
    })

    // ── Live stats (polled by dashboard JS) ────────────────────────────────
    router.get('/api/stats', (_req, res) => {
        const latest = statsHistory[statsHistory.length - 1]
        const ram = latest?.ram ?? Math.round(process.memoryUsage().rss / 1024 / 1024)
        const cpu = latest?.cpu ?? 0
        res.json({ uptimeMs: Date.now() - startTime, ramMb: ram, cpuPercent: cpu, history: statsHistory })
    })

    // ── Log buffer (polled by dashboard JS) ───────────────────────────────
    router.get('/api/logs', (_req, res) => {
        res.json({ logs: getLogBuffer(200) })
    })

    // ── Logs page ──────────────────────────────────────────────────────────
    router.get('/logs', (_req, res) => {
        res.send(renderLogs(getLogBuffer(500)))
    })

    // ── Download today's log file ──────────────────────────────────────────
    router.get('/logs/download', (req, res) => {
        const filePath = getLogFilePath_export()
        if (!fs.existsSync(filePath)) {
            res.status(404).send('No log file for today yet.')
            return
        }
        const filename = filePath.split('/').pop() ?? 'vusync.log'
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        fs.createReadStream(filePath).pipe(res)
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
        const ip = req.ip ?? '?'
        const now = Date.now()
        const entry = loginAttempts.get(ip)
        if (entry && now < entry.resetAt) {
            if (entry.count >= RATE_LIMIT) {
                res.send(renderLogin({ error: 'Too many login attempts. Try again in 15 minutes.' }))
                return
            }
            entry.count++
        } else {
            loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
        }

        const { username, password } = req.body as { username?: string; password?: string }
        const validUser = username === config.admin.username
        const validPass = config.admin.passwordHash && password
            ? await bcrypt.compare(password, config.admin.passwordHash)
            : false
        if (validUser && validPass) {
            loginAttempts.delete(ip)
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
            hasPassword: !!r.hasPassword, permanent: !!r.permanent,
        }))
        res.json({ rooms: list, totalUsers: list.reduce((n, r) => n + r.userCount, 0) })
    })

    // ── Room JSON (polled by room detail page) ─────────────────────────────
    router.get('/api/rooms/:id', (req, res) => {
        const room = rooms.get(req.params.id)
        if (!room) { res.status(404).json({ error: 'not found' }); return }
        res.json(room)
    })

    // ── Toggle permanent ───────────────────────────────────────────────────
    router.post('/rooms/:id/permanent', (req, res) => {
        const room = rooms.get(req.params.id)
        if (!room) {
            res.status(404).send('Room not found.')
            return
        }
        room.permanent = !room.permanent
        logger.info(`Room ${room.id} permanent flag set to ${room.permanent} by admin`)
        saveRooms()
        if (req.body.returnTo === 'list') {
            res.redirect('/admin/rooms')
        } else {
            res.redirect(`/admin/rooms/${req.params.id}`)
        }
    })

    // ── Transfer host ──────────────────────────────────────────────────────
    router.post('/rooms/:id/host/:socketId', (req, res) => {
        const room = rooms.get(req.params.id)
        const io = getIo()
        if (!room || !io) { res.status(404).send('Room not found.'); return }
        const targetId = req.params.socketId
        const target = room.users.find(u => u.id === targetId)
        if (!target || targetId === room.hostId) { res.redirect(`/admin/rooms/${req.params.id}`); return }
        room.hostId = targetId
        delete target.canControl
        for (const u of room.users) io.to(u.id).emit(EVENTS.ROOM_UPDATE, room)
        logger.info(`Host transferred in room ${room.id} to ${targetId} by admin`)
        res.redirect(`/admin/rooms/${room.id}`)
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
        // Temporarily clear permanent flag so removeFromRoom actually deletes it
        room.permanent = false
        // Copy array before iterating — removeFromRoom mutates room.users on each call
        for (const user of [...room.users]) {
            io.sockets.sockets.get(user.id)?.emit(EVENTS.KICKED)
            removeFromRoom(user.id)
        }
        // If room was permanent and now empty, ensure it's gone
        if (rooms.has(room.id)) rooms.delete(room.id)
        saveRooms()
        res.redirect('/admin/rooms')
    })

    return router
}
