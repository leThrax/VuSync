import * as fs from 'fs'
import * as path from 'path'
import type { Room } from '../../shared/types'
import { logger } from './logger'

const DATA_DIR = path.join(__dirname, '..', 'data')
const ROOMS_FILE = path.join(DATA_DIR, 'rooms.json')

interface PersistedEntry {
    room: Room
    password?: string
}

export function savePermanentRooms(rooms: Map<string, Room>, passwords: Map<string, string>): void {
    const entries: PersistedEntry[] = []
    for (const room of rooms.values()) {
        if (!room.permanent) continue
        const entry: PersistedEntry = { room: { ...room, users: [], hostId: '' } }
        const password = passwords.get(room.id)
        if (password !== undefined) entry.password = password
        entries.push(entry)
    }
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
        fs.writeFileSync(ROOMS_FILE, JSON.stringify(entries, null, 2), 'utf8')
    } catch (err) {
        logger.error(`Failed to save permanent rooms: ${err}`)
    }
}

export function loadPermanentRooms(): { rooms: Room[]; passwords: Map<string, string> } {
    const passwords = new Map<string, string>()
    if (!fs.existsSync(ROOMS_FILE)) return { rooms: [], passwords }
    try {
        const entries: PersistedEntry[] = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8'))
        const rooms: Room[] = entries.map(entry => {
            if (entry.password) passwords.set(entry.room.id, entry.password)
            return {
                ...entry.room,
                users: [],
                hostId: '',
                playerState: {
                    ...entry.room.playerState,
                    isPlaying: false,
                    currentTime: 0,
                    lastUpdated: Date.now(),
                },
            }
        })
        logger.info(`Loaded ${rooms.length} permanent room(s) from disk`)
        return { rooms, passwords }
    } catch (err) {
        logger.error(`Failed to load permanent rooms: ${err}`)
        return { rooms: [], passwords }
    }
}
