import { useEffect, useRef, useState } from 'react'
import type { RefObject, MutableRefObject } from 'react'
import type { YouTubePlayer } from 'react-youtube'
import { socket } from '../socket'
import { EVENTS } from '../../../shared/constants'
import type { Room, PlayerState, QueueItem } from '../../../shared/types'

const SYNC_THRESHOLD = 1 // seconds — only seek if drift exceeds this

export interface UseSyncReturn {
    isConnected: boolean
    room: Room | null
    isHost: boolean
    hasControl: boolean
    socketId: string | undefined
    emitPlay: (currentTime: number) => void
    emitPause: (currentTime: number) => void
    emitSeek: (currentTime: number) => void
    emitChangeVideo: (videoId: string) => void
    emitChangeName: (newName: string) => void
    emitKickUser: (targetId: string) => void
    emitGrantControl: (targetId: string) => void
    emitQueueAdd: (videoId: string, position: 'next' | 'last') => void
    emitQueueAddBulk: (items: QueueItem[], position: 'next' | 'last') => void
    emitQueueClear: () => void
    emitQueueAdvance: () => void
    emitQueueRemove: (index: number) => void
    emitQueuePlayItem: (index: number) => void
    programmaticSeekRef: MutableRefObject<boolean>
    createRoom: (roomName: string, userName: string) => void
    joinRoom: (roomId: string, userName: string) => void
    leaveRoom: () => void
}

export function useSync(
    playerRef: RefObject<YouTubePlayer | null>,
    onVideoChange: (videoId: string) => void,
    onKickedFromRoom?: () => void,
    onUserLeft?: (userName: string) => void,
    onJoinedRoom?: () => void,
    onUserJoined?: (userName: string) => void,
): UseSyncReturn {
    const [isConnected, setIsConnected] = useState(socket.connected)
    const [room, setRoom] = useState<Room | null>(null)
    // Stable refs so effect closures always call the latest callbacks
    const onVideoChangeRef = useRef(onVideoChange)
    useEffect(() => { onVideoChangeRef.current = onVideoChange }, [onVideoChange])
    const onKickedRef = useRef(onKickedFromRoom)
    useEffect(() => { onKickedRef.current = onKickedFromRoom }, [onKickedFromRoom])
    const onUserLeftRef = useRef(onUserLeft)
    useEffect(() => { onUserLeftRef.current = onUserLeft }, [onUserLeft])
    const onJoinedRoomRef = useRef(onJoinedRoom)
    useEffect(() => { onJoinedRoomRef.current = onJoinedRoom }, [onJoinedRoom])
    const onUserJoinedRef = useRef(onUserJoined)
    useEffect(() => { onUserJoinedRef.current = onUserJoined }, [onUserJoined])
    // Tracks whether we're currently in a room (used to detect the initial join)
    const inRoomRef = useRef(false)
    // Flags a seekTo call made by a sync handler so handleStateChange can ignore the resulting 2→3 transition
    const programmaticSeekRef = useRef(false)

    useEffect(() => {
        socket.connect()

        function onConnect() { setIsConnected(true) }
        function onDisconnect() { setIsConnected(false) }

        function onRoomUpdate(updated: Room) {
            const isFirstUpdate = !inRoomRef.current
            const joiningNow = isFirstUpdate && updated.hostId !== socket.id
            inRoomRef.current = true

            if (isFirstUpdate) {
                onJoinedRoomRef.current?.()
            }

            if (joiningNow) {
                // Compensate for time elapsed since the host last updated the server
                const elapsed = updated.playerState.isPlaying
                    ? Math.max(0, (Date.now() - updated.playerState.lastUpdated) / 1000)
                    : 0
                const synced = elapsed > 0
                    ? { ...updated, playerState: { ...updated.playerState, currentTime: updated.playerState.currentTime + elapsed } }
                    : updated
                setRoom(synced)
                onVideoChangeRef.current(updated.playerState.videoId)

                if (updated.playerState.isPlaying) {
                    const joinTime = Date.now()
                    const baseTime = synced.playerState.currentTime
                    let attempts = 0
                    const tryInitialSync = () => {
                        const player = playerRef.current
                        if (!player) {
                            if (++attempts < 15) setTimeout(tryInitialSync, 200)
                            return
                        }
                        const additionalElapsed = (Date.now() - joinTime) / 1000
                        const wasMuted = player.isMuted()
                        programmaticSeekRef.current = true
                        setTimeout(() => { programmaticSeekRef.current = false }, 500)
                        // mute BEFORE seekTo: seekTo on a cued player triggers playback;
                        // must be muted first so that triggered play is already muted.
                        player.mute()
                        player.seekTo(baseTime + additionalElapsed, true)
                        player.playVideo()
                        if (!wasMuted) setTimeout(() => { player.unMute() }, 500)
                    }
                    setTimeout(tryInitialSync, 500)
                }
                return
            }

            setRoom(updated)
        }

        async function onPlay(state: PlayerState) {
            setRoom(prev => prev ? { ...prev, playerState: state } : null)
            const player = playerRef.current
            if (!player) return
            programmaticSeekRef.current = true
            setTimeout(() => { programmaticSeekRef.current = false }, 500)
            const currentTime: number = await player.getCurrentTime()
            if (Math.abs(currentTime - state.currentTime) > SYNC_THRESHOLD) {
                player.seekTo(state.currentTime, true)
            }
            player.playVideo()
        }

        async function onPause(state: PlayerState) {
            setRoom(prev => prev ? { ...prev, playerState: state } : null)
            const player = playerRef.current
            if (!player) return
            programmaticSeekRef.current = true
            setTimeout(() => { programmaticSeekRef.current = false }, 500)
            const currentTime: number = await player.getCurrentTime()
            if (Math.abs(currentTime - state.currentTime) > SYNC_THRESHOLD) {
                player.seekTo(state.currentTime, true)
            }
            player.pauseVideo()
        }

        async function onSeek(state: PlayerState) {
            setRoom(prev => prev ? { ...prev, playerState: state } : null)
            const player = playerRef.current
            if (!player) return
            programmaticSeekRef.current = true
            setTimeout(() => { programmaticSeekRef.current = false }, 500)
            const currentTime: number = await player.getCurrentTime()
            if (Math.abs(currentTime - state.currentTime) > SYNC_THRESHOLD) {
                player.seekTo(state.currentTime, true)
            }
        }

        function onChangeVideo(state: PlayerState) {
            onVideoChangeRef.current(state.videoId)
        }

        function onKicked() {
            inRoomRef.current = false
            setRoom(null)
            onKickedRef.current?.()
        }

        function onUserLeftHandler(payload: { userId: string; userName: string }) {
            onUserLeftRef.current?.(payload.userName)
        }

        function onUserJoinedHandler(payload: { userName: string }) {
            onUserJoinedRef.current?.(payload.userName)
        }

        async function onSyncState(state: PlayerState) {
            const player = playerRef.current
            if (!player) return
            programmaticSeekRef.current = true
            setTimeout(() => { programmaticSeekRef.current = false }, 500)
            const currentTime: number = await player.getCurrentTime()
            if (Math.abs(currentTime - state.currentTime) > SYNC_THRESHOLD) {
                player.seekTo(state.currentTime, true)
            }
            if (state.isPlaying) {
                player.playVideo()
            } else {
                player.pauseVideo()
            }
        }

        socket.on('connect', onConnect)
        socket.on('disconnect', onDisconnect)
        socket.on(EVENTS.ROOM_UPDATE, onRoomUpdate)
        socket.on(EVENTS.PLAY, onPlay)
        socket.on(EVENTS.PAUSE, onPause)
        socket.on(EVENTS.SEEK, onSeek)
        socket.on(EVENTS.CHANGE_VIDEO, onChangeVideo)
        socket.on(EVENTS.SYNC_STATE, onSyncState)
        socket.on(EVENTS.KICKED, onKicked)
        socket.on(EVENTS.USER_LEFT, onUserLeftHandler)
        socket.on(EVENTS.USER_JOINED, onUserJoinedHandler)

        return () => {
            socket.off('connect', onConnect)
            socket.off('disconnect', onDisconnect)
            socket.off(EVENTS.ROOM_UPDATE, onRoomUpdate)
            socket.off(EVENTS.PLAY, onPlay)
            socket.off(EVENTS.PAUSE, onPause)
            socket.off(EVENTS.SEEK, onSeek)
            socket.off(EVENTS.CHANGE_VIDEO, onChangeVideo)
            socket.off(EVENTS.SYNC_STATE, onSyncState)
            socket.off(EVENTS.KICKED, onKicked)
            socket.off(EVENTS.USER_LEFT, onUserLeftHandler)
            socket.off(EVENTS.USER_JOINED, onUserJoinedHandler)
            socket.disconnect()
        }
    }, [playerRef]) // playerRef is a stable ref object — effect runs once on mount

    const isHost = room !== null && room.hostId === socket.id
    const hasControl = isHost || (room !== null && room.users.find(u => u.id === socket.id)?.canControl === true)

    function createRoom(roomName: string, userName: string) {
        socket.emit(EVENTS.CREATE_ROOM, { name: roomName, userName })
    }

    function joinRoom(roomId: string, userName: string) {
        socket.emit(EVENTS.JOIN_ROOM, { roomId, userName })
    }

    function emitPlay(currentTime: number) {
        if (!room || !hasControl) return
        socket.emit(EVENTS.PLAY, { roomId: room.id, currentTime })
    }

    function emitPause(currentTime: number) {
        if (!room || !hasControl) return
        socket.emit(EVENTS.PAUSE, { roomId: room.id, currentTime })
    }

    function emitSeek(currentTime: number) {
        if (!room || !hasControl) return
        socket.emit(EVENTS.SEEK, { roomId: room.id, currentTime })
    }

    function emitChangeVideo(videoId: string) {
        if (!room) return
        socket.emit(EVENTS.CHANGE_VIDEO, { roomId: room.id, videoId })
    }

    function emitChangeName(newName: string) {
        if (!room) return
        socket.emit(EVENTS.CHANGE_NAME, { roomId: room.id, newName })
    }

    function emitKickUser(targetId: string) {
        if (!room || !isHost) return
        socket.emit(EVENTS.KICK_USER, { roomId: room.id, targetId })
    }

    function emitGrantControl(targetId: string) {
        if (!room || !isHost) return
        socket.emit(EVENTS.GRANT_CONTROL, { roomId: room.id, targetId })
    }

    function emitQueueAdd(videoId: string, position: 'next' | 'last') {
        if (!room || !hasControl) return
        socket.emit(EVENTS.QUEUE_ADD, { roomId: room.id, videoId, position })
    }

    function emitQueueAddBulk(items: QueueItem[], position: 'next' | 'last') {
        if (!room || !hasControl) return
        socket.emit(EVENTS.QUEUE_ADD_BULK, { roomId: room.id, items, position })
    }

    function emitQueueClear() {
        if (!room || !hasControl) return
        socket.emit(EVENTS.QUEUE_CLEAR, { roomId: room.id })
    }

    function emitQueueAdvance() {
        if (!room || !hasControl) return
        socket.emit(EVENTS.QUEUE_ADVANCE, { roomId: room.id })
    }

    function emitQueueRemove(index: number) {
        if (!room || !hasControl) return
        socket.emit(EVENTS.QUEUE_REMOVE, { roomId: room.id, index })
    }

    function emitQueuePlayItem(index: number) {
        if (!room || !hasControl) return
        socket.emit(EVENTS.QUEUE_PLAY_ITEM, { roomId: room.id, index })
    }

    function leaveRoom() {
        if (!room) return
        socket.emit(EVENTS.LEAVE_ROOM)
        inRoomRef.current = false
        setRoom(null)
    }

    return { isConnected, room, isHost, hasControl, socketId: socket.id, emitPlay, emitPause, emitSeek, emitChangeVideo, emitChangeName, emitKickUser, emitGrantControl, emitQueueAdd, emitQueueAddBulk, emitQueueClear, emitQueueAdvance, emitQueueRemove, emitQueuePlayItem, programmaticSeekRef, createRoom, joinRoom, leaveRoom }
}