import { Server, Socket } from 'socket.io'
import { EVENTS } from '../../../shared/constants'
import type { Room, User, PlayerState, ChatMessage } from '../../../shared/types'
import { config } from '../config'

async function fetchVideoTitle(videoId: string): Promise<string> {
    try {
        const res = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`
        )
        if (!res.ok) return videoId
        const json = await res.json() as { title?: string }
        return json.title || videoId
    } catch {
        return videoId
    }
}

const rooms = new Map<string, Room>()
const socketRooms = new Map<string, string>() // socketId → roomId

function generateId(): string {
    return Math.random().toString(36).slice(2, 9)
}

export function setupSocketHandlers(io: Server): void {
    io.on('connection', (socket: Socket) => {
        console.log(`User connected: ${socket.id}`)

        socket.on(EVENTS.CREATE_ROOM, (payload: { name: string; userName: string }) => {
            const roomId = generateId()
            const user: User = { id: socket.id, name: payload.userName || 'Host', roomId }
            const room: Room = {
                id: roomId,
                name: payload.name,
                hostId: socket.id,
                users: [user],
                playerState: {
                    isPlaying: false,
                    currentTime: 0,
                    videoId: config.defaultVideoId,
                    lastUpdated: Date.now(),
                },
                queue: [],
            }
            rooms.set(roomId, room)
            socketRooms.set(socket.id, roomId)
            socket.join(roomId)
            socket.emit(EVENTS.ROOM_UPDATE, room)
            console.log(`Room created: ${roomId} by ${payload.userName}`)
        })

        socket.on(EVENTS.JOIN_ROOM, (payload: { roomId: string; userName: string }) => {
            const room = rooms.get(payload.roomId)
            if (!room) {
                socket.emit('error', { message: 'Room not found' })
                return
            }
            const guestNumber = room.users.filter(u => u.id !== room.hostId).length + 1
            const user: User = { id: socket.id, name: payload.userName || `Guest${guestNumber}`, roomId: payload.roomId }
            room.users.push(user)
            socketRooms.set(socket.id, payload.roomId)
            socket.join(payload.roomId)
            // Notify existing members that someone joined (skip the joiner themselves)
            for (const u of room.users) {
                if (u.id !== socket.id) {
                    io.to(u.id).emit(EVENTS.USER_JOINED, { userName: user.name })
                }
            }
            // Emit directly to each user's socket — bypasses room-membership edge cases
            for (const u of room.users) {
                io.to(u.id).emit(EVENTS.ROOM_UPDATE, room)
            }
            console.log(`${payload.userName} joined room ${payload.roomId}, notifying ${room.users.map(u => u.id).join(', ')}`)
        })

        socket.on(EVENTS.LEAVE_ROOM, () => {
            removeFromRoom(socket.id)
        })

        function hasControl(room: Room): boolean {
            return room.hostId === socket.id || room.users.find(u => u.id === socket.id)?.canControl === true
        }

        socket.on(EVENTS.PLAY, (payload: { roomId: string; currentTime: number }) => {
            const room = rooms.get(payload.roomId)
            if (!room || !hasControl(room)) return
            room.playerState = { ...room.playerState, isPlaying: true, currentTime: payload.currentTime, lastUpdated: Date.now() }
            socket.to(payload.roomId).emit(EVENTS.PLAY, room.playerState)
        })

        socket.on(EVENTS.PAUSE, (payload: { roomId: string; currentTime: number }) => {
            const room = rooms.get(payload.roomId)
            if (!room || !hasControl(room)) return
            room.playerState = { ...room.playerState, isPlaying: false, currentTime: payload.currentTime, lastUpdated: Date.now() }
            socket.to(payload.roomId).emit(EVENTS.PAUSE, room.playerState)
        })

        socket.on(EVENTS.SEEK, (payload: { roomId: string; currentTime: number }) => {
            const room = rooms.get(payload.roomId)
            if (!room || !hasControl(room)) return
            room.playerState = { ...room.playerState, currentTime: payload.currentTime, lastUpdated: Date.now() }
            socket.to(payload.roomId).emit(EVENTS.SEEK, room.playerState)
        })

        socket.on(EVENTS.CHANGE_VIDEO, (payload: { roomId: string; videoId: string }) => {
            const room = rooms.get(payload.roomId)
            if (!room || !hasControl(room)) return
            room.playerState = { isPlaying: false, currentTime: 0, videoId: payload.videoId, lastUpdated: Date.now() }
            socket.to(payload.roomId).emit(EVENTS.CHANGE_VIDEO, room.playerState)
        })

        socket.on(EVENTS.QUEUE_ADD, async (payload: { roomId: string; videoId: string; position: 'next' | 'last' }) => {
            const room = rooms.get(payload.roomId)
            if (!room || !hasControl(room) || !payload.videoId) return
            const title = await fetchVideoTitle(payload.videoId)
            const item = { videoId: payload.videoId, title }
            if (payload.position === 'next') {
                room.queue.unshift(item)
            } else {
                room.queue.push(item)
            }
            for (const u of room.users) {
                io.to(u.id).emit(EVENTS.ROOM_UPDATE, room)
            }
        })

        socket.on(EVENTS.QUEUE_ADD_BULK, (payload: { roomId: string; items: QueueItem[]; position: 'next' | 'last' }) => {
            const room = rooms.get(payload.roomId)
            if (!room || !hasControl(room) || !payload.items?.length) return
            if (payload.position === 'next') {
                room.queue = [...payload.items, ...room.queue]
            } else {
                room.queue = [...room.queue, ...payload.items]
            }
            for (const u of room.users) {
                io.to(u.id).emit(EVENTS.ROOM_UPDATE, room)
            }
        })

        socket.on(EVENTS.QUEUE_CLEAR, (payload: { roomId: string }) => {
            const room = rooms.get(payload.roomId)
            if (!room || !hasControl(room)) return
            room.queue = []
            for (const u of room.users) {
                io.to(u.id).emit(EVENTS.ROOM_UPDATE, room)
            }
        })

        socket.on(EVENTS.QUEUE_ADVANCE, (payload: { roomId: string }) => {
            const room = rooms.get(payload.roomId)
            if (!room || !hasControl(room)) return
            const nextItem = room.queue.shift()
            if (!nextItem) return
            room.playerState = { isPlaying: false, currentTime: 0, videoId: nextItem.videoId, lastUpdated: Date.now() }
            // Include sender so their player updates too
            io.to(payload.roomId).emit(EVENTS.CHANGE_VIDEO, room.playerState)
            for (const u of room.users) {
                io.to(u.id).emit(EVENTS.ROOM_UPDATE, room)
            }
        })

        socket.on(EVENTS.QUEUE_REMOVE, (payload: { roomId: string; index: number }) => {
            const room = rooms.get(payload.roomId)
            if (!room || !hasControl(room)) return
            room.queue.splice(payload.index, 1)
            for (const u of room.users) {
                io.to(u.id).emit(EVENTS.ROOM_UPDATE, room)
            }
        })

        socket.on(EVENTS.QUEUE_PLAY_ITEM, (payload: { roomId: string; index: number }) => {
            const room = rooms.get(payload.roomId)
            if (!room || !hasControl(room)) return
            const [item] = room.queue.splice(payload.index, 1)
            if (!item) return
            room.playerState = { isPlaying: false, currentTime: 0, videoId: item.videoId, lastUpdated: Date.now() }
            io.to(payload.roomId).emit(EVENTS.CHANGE_VIDEO, room.playerState)
            for (const u of room.users) {
                io.to(u.id).emit(EVENTS.ROOM_UPDATE, room)
            }
        })

        socket.on(EVENTS.QUEUE_REORDER, (payload: { roomId: string; fromIndex: number; toIndex: number }) => {
            const room = rooms.get(payload.roomId)
            if (!room || !hasControl(room)) return
            const { fromIndex, toIndex } = payload
            if (fromIndex < 0 || fromIndex >= room.queue.length) return
            if (toIndex < 0 || toIndex >= room.queue.length) return
            const [item] = room.queue.splice(fromIndex, 1)
            room.queue.splice(toIndex, 0, item)
            for (const u of room.users) {
                io.to(u.id).emit(EVENTS.ROOM_UPDATE, room)
            }
        })

        socket.on(EVENTS.GRANT_CONTROL, (payload: { roomId: string; targetId: string }) => {
            const room = rooms.get(payload.roomId)
            if (!room || room.hostId !== socket.id) return
            const target = room.users.find(u => u.id === payload.targetId)
            if (!target || target.id === room.hostId) return
            target.canControl = !target.canControl
            for (const u of room.users) {
                io.to(u.id).emit(EVENTS.ROOM_UPDATE, room)
            }
        })

        // Host-only: periodic full state push (e.g. triggered when a guest joins)
        socket.on(EVENTS.SYNC_STATE, (payload: { roomId: string; playerState: PlayerState }) => {
            const room = rooms.get(payload.roomId)
            if (!room || room.hostId !== socket.id) return
            room.playerState = { ...payload.playerState, lastUpdated: Date.now() }
            socket.to(payload.roomId).emit(EVENTS.SYNC_STATE, room.playerState)
        })

        socket.on(EVENTS.KICK_USER, (payload: { roomId: string; targetId: string }) => {
            const room = rooms.get(payload.roomId)
            if (!room || room.hostId !== socket.id) return
            if (payload.targetId === socket.id) return
            io.to(payload.targetId).emit(EVENTS.KICKED)
            removeFromRoom(payload.targetId)
        })

        socket.on(EVENTS.CHANGE_NAME, (payload: { roomId: string; newName: string }) => {
            const room = rooms.get(payload.roomId)
            if (!room) return
            const user = room.users.find((u: User) => u.id === socket.id)
            if (!user) return
            user.name = payload.newName.trim() || user.name
            for (const u of room.users) {
                io.to(u.id).emit(EVENTS.ROOM_UPDATE, room)
            }
        })

        socket.on(EVENTS.CHAT_MESSAGE, (payload: ChatMessage & { roomId: string }) => {
            const { roomId, ...message } = payload
            io.to(roomId).emit(EVENTS.CHAT_MESSAGE, message)
        })

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`)
            removeFromRoom(socket.id)
        })
    })

    function removeFromRoom(socketId: string): void {
        const roomId = socketRooms.get(socketId)
        if (!roomId) return
        const room = rooms.get(roomId)
        if (!room) return

        // Leave the Socket.IO room so socket.to(roomId) no longer reaches this socket
        io.sockets.sockets.get(socketId)?.leave(roomId)

        const leavingUser = room.users.find((u: User) => u.id === socketId)
        room.users = room.users.filter((u: User) => u.id !== socketId)
        socketRooms.delete(socketId)

        if (room.users.length === 0) {
            rooms.delete(roomId)
            console.log(`Room ${roomId} deleted (empty)`)
            return
        }

        // Transfer host to next user if the host left
        if (room.hostId === socketId) {
            room.hostId = room.users[0].id
            delete room.users[0].canControl
            console.log(`Host transferred in room ${roomId} to ${room.hostId}`)
        }

        for (const u of room.users) {
            io.to(u.id).emit(EVENTS.USER_LEFT, { userId: socketId, userName: leavingUser?.name ?? 'Someone' })
            io.to(u.id).emit(EVENTS.ROOM_UPDATE, room)
        }
    }
}