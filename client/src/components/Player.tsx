import { useRef, useState, useEffect } from 'react'
import YouTube from 'react-youtube'
import type { YouTubeEvent } from 'react-youtube'
import type { YouTubePlayer } from 'react-youtube'
import { useSync } from '../hooks/useSync'
import { SERVER_URL } from '../socket'
import { extractVideoId, extractPlaylistId } from '../utils'
import type { QueueItem } from '../../../shared/types'
import UserList from './UserList'
import QueuePanel from './QueuePanel'
import GradientText from './GradientText'
import './Player.css'

interface Toast { id: number; message: string; side: 'left' | 'right'; type: 'danger' | 'success' }

const MIN_PLAYER_WIDTH = 600
const MAX_PLAYER_WIDTH = 1760

export default function Player() {
    const [videoId, setVideoId] = useState('')
    const [playerWidth, setPlayerWidth] = useState(() => {
        const saved = localStorage.getItem('vusync-player-width')
        return saved ? Math.max(MIN_PLAYER_WIDTH, Math.min(MAX_PLAYER_WIDTH, Number(saved))) : MAX_PLAYER_WIDTH
    })
    const [urlInput, setUrlInput] = useState('')
    const [joinInput, setJoinInput] = useState('')
    const [nameInput, setNameInput] = useState(() => localStorage.getItem('vusync-username') ?? '')
    const [toasts, setToasts] = useState<Toast[]>([])
    const [isValidating, setIsValidating] = useState(false)
    const playerRef = useRef<YouTubePlayer | null>(null)
    const prevStateRef = useRef(-1)
    const toastIdRef = useRef(0)
    const pauseEmitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pendingRoomRef = useRef<string | null>(null)
    const isResizingRef = useRef(false)
    const resizeStartXRef = useRef(0)
    const resizeStartWidthRef = useRef(0)

    useEffect(() => {
        localStorage.setItem('vusync-player-width', String(playerWidth))
    }, [playerWidth])

    function addToast(message: string, side: 'left' | 'right', type: 'danger' | 'success' = 'success') {
        const id = ++toastIdRef.current
        setToasts(prev => [...prev, { id, message, side, type }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
    }

    const { isConnected, room, isHost, hasControl, socketId, emitPlay, emitPause, emitSeek, emitChangeVideo, emitChangeName, emitKickUser, emitGrantControl, emitQueueAdd, emitQueueAddBulk, emitQueueClear, emitQueueAdvance, emitQueueRemove, emitQueuePlayItem, emitQueueReorder, emitQueueShuffle, programmaticSeekRef, createRoom, joinRoom, leaveRoom } =
        useSync(
            playerRef,
            setVideoId,
            () => addToast('You were kicked from the room', 'left', 'danger'),
            (userName) => addToast(`${userName} left the room`, 'left'),
            () => addToast('Joined the room', 'left'),
            (userName) => addToast(`${userName} joined the room`, 'left'),
        )

    // Always-current ref for room — avoids stale closures in YouTube event callbacks
    const roomRef = useRef(room)
    roomRef.current = room

    // Fetch default video ID from server config on mount
    useEffect(() => {
        fetch(`${SERVER_URL}/api/config`)
            .then(r => r.json())
            .then((d: { defaultVideoId: string }) => {
                if (d.defaultVideoId) setVideoId(d.defaultVideoId)
            })
            .catch(() => {})
    }, [])

    // Read room code from URL on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const roomId = params.get('room')
        if (roomId) pendingRoomRef.current = roomId
    }, [])

    // Auto-join once socket is connected
    useEffect(() => {
        if (isConnected && pendingRoomRef.current && !room) {
            joinRoom(pendingRoomRef.current, '')
            pendingRoomRef.current = null
        }
    }, [isConnected, room])

    // Keep URL in sync with room state
    useEffect(() => {
        if (room) {
            window.history.replaceState(null, '', `?room=${room.id}`)
        } else {
            window.history.replaceState(null, '', '/')
        }
    }, [room])

    function handleKick(targetId: string) {
        emitKickUser(targetId)
        addToast('User kicked successfully', 'left')
    }

    async function validateVideo(id: string): Promise<boolean> {
        setIsValidating(true)
        try {
            const res = await fetch(`${SERVER_URL}/api/check-video/${encodeURIComponent(id)}`)
            const data = await res.json() as { available: boolean }
            return data.available
        } catch {
            return false
        } finally {
            setIsValidating(false)
        }
    }

    async function fetchPlaylist(playlistId: string): Promise<{ available: boolean; videos: QueueItem[] }> {
        setIsValidating(true)
        try {
            const res = await fetch(`${SERVER_URL}/api/playlist/${encodeURIComponent(playlistId)}`)
            return await res.json() as { available: boolean; videos: QueueItem[] }
        } catch {
            return { available: false, videos: [] }
        } finally {
            setIsValidating(false)
        }
    }

    async function handleQueueNext() {
        const playlistId = extractPlaylistId(urlInput)
        if (playlistId) {
            const result = await fetchPlaylist(playlistId)
            if (!result.available) {
                addToast('No playlist found at this URL', 'left', 'danger')
                return
            }
            setUrlInput('')
            emitQueueAddBulk(result.videos, 'next')
            addToast(`Added ${result.videos.length} video${result.videos.length === 1 ? '' : 's'} to queue`, 'left')
            return
        }
        const id = extractVideoId(urlInput)
        if (!id) return
        if (!await validateVideo(id)) {
            addToast('No video found at this URL', 'left', 'danger')
            return
        }
        setUrlInput('')
        emitQueueAdd(id, 'next')
    }

    async function handleQueueLast() {
        const playlistId = extractPlaylistId(urlInput)
        if (playlistId) {
            const result = await fetchPlaylist(playlistId)
            if (!result.available) {
                addToast('No playlist found at this URL', 'left', 'danger')
                return
            }
            setUrlInput('')
            emitQueueAddBulk(result.videos, 'last')
            addToast(`Added ${result.videos.length} video${result.videos.length === 1 ? '' : 's'} to queue`, 'left')
            return
        }
        const id = extractVideoId(urlInput)
        if (!id) return
        if (!await validateVideo(id)) {
            addToast('No video found at this URL', 'left', 'danger')
            return
        }
        setUrlInput('')
        emitQueueAdd(id, 'last')
    }

    function handleEnd() {
        if (hasControl && room && room.queue.length > 0) {
            emitQueueAdvance()
        }
    }

    function handleReady(event: YouTubeEvent) {
        playerRef.current = event.target
        const currentRoom = roomRef.current
        if (currentRoom) {
            const state = currentRoom.playerState
            // setTimeout(0): react-youtube's updateVideo() queues a cueVideoById call via a
            // resolved Promise (.then microtask). Microtasks run before macrotasks, so by the
            // time this callback fires, cueVideoById has already been sent to the iframe and
            // the video is correctly cued — our seekTo/playVideo then run last, not overridden.
            setTimeout(() => {
                programmaticSeekRef.current = true
                setTimeout(() => { programmaticSeekRef.current = false }, 500)
                if (state.isPlaying) {
                    // mute BEFORE seekTo: seekTo on a VIDEO_CUED player triggers playback
                    // immediately — if unmuted at that moment, the browser blocks it (no user
                    // gesture on URL-join). Muting first ensures the triggered play is muted.
                    const wasMuted = event.target.isMuted()
                    event.target.mute()
                    event.target.seekTo(state.currentTime, true)
                    event.target.playVideo()
                    if (!wasMuted) setTimeout(() => { event.target.unMute() }, 500)
                } else {
                    event.target.seekTo(state.currentTime, true)
                    event.target.pauseVideo()
                }
            }, 0)
        }
    }

    async function handlePlay(event: YouTubeEvent) {
        if (!hasControl) {
            if (room && !programmaticSeekRef.current) {
                const elapsed = room.playerState.isPlaying
                    ? Math.max(0, (Date.now() - room.playerState.lastUpdated) / 1000)
                    : 0
                programmaticSeekRef.current = true
                setTimeout(() => { programmaticSeekRef.current = false }, 500)
                event.target.seekTo(room.playerState.currentTime + elapsed, true)
                if (!room.playerState.isPlaying) event.target.pauseVideo()
            }
            return
        }
        const currentTime = await event.target.getCurrentTime()
        emitPlay(currentTime)
    }

    async function handlePause(event: YouTubeEvent) {
        if (!hasControl) {
            if (room && !programmaticSeekRef.current) {
                const elapsed = room.playerState.isPlaying
                    ? Math.max(0, (Date.now() - room.playerState.lastUpdated) / 1000)
                    : 0
                programmaticSeekRef.current = true
                setTimeout(() => { programmaticSeekRef.current = false }, 500)
                event.target.seekTo(room.playerState.currentTime + elapsed, true)
                if (room.playerState.isPlaying) event.target.playVideo()
            }
            return
        }
        const currentTime = await event.target.getCurrentTime()
        // Delay emission so a seek (state 2→3) can cancel this before it fires
        if (pauseEmitTimeoutRef.current !== null) clearTimeout(pauseEmitTimeoutRef.current)
        pauseEmitTimeoutRef.current = setTimeout(() => {
            pauseEmitTimeoutRef.current = null
            emitPause(currentTime)
        }, 100)
    }

    function handleStateChange(event: YouTubeEvent<number>) {
        if ((prevStateRef.current === 1 || prevStateRef.current === 2) && event.data === 3) {
            if (hasControl) {
                // Seeking: cancel the pending pause (it was a seek-pause, not a real pause)
                if (pauseEmitTimeoutRef.current !== null) {
                    clearTimeout(pauseEmitTimeoutRef.current)
                    pauseEmitTimeoutRef.current = null
                }
                event.target.getCurrentTime().then((t: number) => emitSeek(t))
            } else if (room && !programmaticSeekRef.current) {
                // No-permission seek — snap back to the room's current position
                const elapsed = room.playerState.isPlaying
                    ? Math.max(0, (Date.now() - room.playerState.lastUpdated) / 1000)
                    : 0
                programmaticSeekRef.current = true
                setTimeout(() => { programmaticSeekRef.current = false }, 500)
                event.target.seekTo(room.playerState.currentTime + elapsed, true)
                if (room.playerState.isPlaying) event.target.playVideo()
            }
        }
        prevStateRef.current = event.data
    }

    async function handleUrlSubmit(e: { preventDefault(): void }) {
        e.preventDefault()
        const playlistId = extractPlaylistId(urlInput)
        if (playlistId) {
            const result = await fetchPlaylist(playlistId)
            if (!result.available) {
                addToast('No playlist found at this URL', 'left', 'danger')
                return
            }
            const [first, ...rest] = result.videos
            if (!first) return
            setUrlInput('')
            if (room) {
                emitChangeVideo(first.videoId)
            }
            setVideoId(first.videoId)
            if (rest.length > 0 && room) {
                emitQueueAddBulk(rest, 'next')
            }
            return
        }
        const id = extractVideoId(urlInput)
        if (!id) return
        if (!await validateVideo(id)) {
            addToast('No video found at this URL', 'left', 'danger')
            return
        }
        setUrlInput('')
        if (room) {
            emitChangeVideo(id)
        }
        setVideoId(id)
    }

    useEffect(() => {
        function onMouseMove(e: MouseEvent) {
            if (!isResizingRef.current) return
            const dx = e.clientX - resizeStartXRef.current
            setPlayerWidth(w => Math.max(MIN_PLAYER_WIDTH, Math.min(MAX_PLAYER_WIDTH, resizeStartWidthRef.current + dx * 2)))
        }
        function onMouseUp() {
            if (!isResizingRef.current) return
            isResizingRef.current = false
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
        return () => {
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('mouseup', onMouseUp)
        }
    }, [])

    function handleResizeMouseDown(e: React.MouseEvent) {
        e.preventDefault()
        isResizingRef.current = true
        resizeStartXRef.current = e.clientX
        resizeStartWidthRef.current = playerWidth
        document.body.style.cursor = 'ew-resize'
        document.body.style.userSelect = 'none'
    }

    function handleChangeName(name: string) {
        localStorage.setItem('vusync-username', name)
        setNameInput(name)
        emitChangeName(name)
    }

    function handleCreateRoom() {
        createRoom('My Room', nameInput.trim())
    }

    function handleJoinRoom(e: { preventDefault(): void }) {
        e.preventDefault()
        if (!joinInput.trim()) return
        joinRoom(joinInput.trim(), nameInput.trim())
        setJoinInput('')
    }

    const inRoom = room !== null

    return (
        <div className="player-layout">
            {toasts.filter(t => t.side === 'left').length > 0 && (
                <div className="toast-container toast-container--left">
                    {toasts.filter(t => t.side === 'left').map(t => (
                        <div key={t.id} className={`toast toast--${t.type}`}>{t.message}</div>
                    ))}
                </div>
            )}
            {toasts.filter(t => t.side === 'right').length > 0 && (
                <div className="toast-container toast-container--right">
                    {toasts.filter(t => t.side === 'right').map(t => (
                        <div key={t.id} className={`toast toast--${t.type}`}>{t.message}</div>
                    ))}
                </div>
            )}

            <div className="player-stage">
                <div
                    className="player-resize-wrap"
                    style={{ width: `min(${playerWidth}px, 98vw)` }}
                >
                    <div className="player-wrapper">
                        {!videoId ? (
                            <div className="vusync-placeholder">
                                <div className="vusync-title-wrap">
                                    <GradientText>VuSync</GradientText>
                                </div>
                            </div>
                        ) : (
                            <YouTube
                                videoId={videoId}
                                className="youtube-player"
                                opts={{ width: '100%', height: '100%' }}
                                onReady={handleReady}
                                onPlay={handlePlay}
                                onPause={handlePause}
                                onStateChange={handleStateChange}
                                onEnd={handleEnd}
                            />
                        )}
                    </div>
                    <div className="player-resize-handle" onMouseDown={handleResizeMouseDown} />
                </div>
            </div>

            <div className="right-panel">
                <UserList
                    room={room}
                    socketId={socketId}
                    currentName={nameInput}
                    onChangeName={handleChangeName}
                    onKick={handleKick}
                    onGrantControl={emitGrantControl}
                />
                {inRoom && (
                    <QueuePanel
                        queue={room.queue}
                        hasControl={hasControl}
                        onRemove={emitQueueRemove}
                        onPlayItem={emitQueuePlayItem}
                        onReorder={emitQueueReorder}
                        onShuffle={emitQueueShuffle}
                        onClear={() => { emitQueueClear(); addToast('Queue cleared', 'left') }}
                        onSkip={emitQueueAdvance}
                    />
                )}
            </div>

            <div className="bottom-bar">
                {!inRoom ? (
                    <>
                        <div className="room-controls">
                            <button
                                className="room-btn room-btn--create"
                                onClick={handleCreateRoom}
                                disabled={!isConnected}
                            >
                                Create room
                            </button>
                            <form className="room-join-form" onSubmit={handleJoinRoom}>
                                <input
                                    className="room-join-input"
                                    value={joinInput}
                                    onChange={e => setJoinInput(e.target.value)}
                                    placeholder="Room code…"
                                    disabled={!isConnected}
                                />
                                <button className="room-btn" type="submit" disabled={!isConnected}>
                                    Join
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="bar-row">
                            <div className="bar-row__center">
                                <span
                                    className="room-code room-code--clickable"
                                    onClick={() => {
                                        if (navigator.clipboard) {
                                            navigator.clipboard.writeText(room.id)
                                        } else {
                                            const el = document.createElement('textarea')
                                            el.value = room.id
                                            el.style.cssText = 'position:fixed;opacity:0'
                                            document.body.appendChild(el)
                                            el.select()
                                            document.execCommand('copy')
                                            document.body.removeChild(el)
                                        }
                                        addToast('Room code copied!', 'left')
                                    }}
                                    title="Click to copy"
                                >Code: <strong>{room.id}</strong></span>
                                <form className="url-form" onSubmit={handleUrlSubmit}>
                                    <input
                                        className="url-input"
                                        value={urlInput}
                                        onChange={e => setUrlInput(e.target.value)}
                                        placeholder={!hasControl ? 'Only the host can change the video' : 'Paste a YouTube URL or playlist…'}
                                        disabled={!hasControl}
                                    />
                                    <button className="url-submit" type="submit" disabled={!hasControl || isValidating}>
                                        {isValidating ? 'Checking…' : 'Load'}
                                    </button>
                                    <button
                                        type="button"
                                        className="url-queue-btn"
                                        onClick={handleQueueNext}
                                        disabled={!hasControl || (!extractVideoId(urlInput) && !extractPlaylistId(urlInput)) || isValidating}
                                    >Queue next</button>
                                    <button
                                        type="button"
                                        className="url-queue-btn"
                                        onClick={handleQueueLast}
                                        disabled={!hasControl || (!extractVideoId(urlInput) && !extractPlaylistId(urlInput)) || isValidating}
                                    >Queue last</button>
                                </form>
                            </div>
                            <button
                                type="button"
                                className="room-btn room-btn--leave bar-row__leave"
                                onClick={() => { addToast('Room left', 'left'); leaveRoom() }}
                            >
                                Leave
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}