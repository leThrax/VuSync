import { useRef, useState } from 'react'
import YouTube from 'react-youtube'
import type { YouTubeEvent } from 'react-youtube'
import type { YouTubePlayer } from 'react-youtube'
import { useSync } from '../hooks/useSync'
import { SERVER_URL } from '../socket'
import { extractVideoId, extractPlaylistId } from '../utils'
import type { QueueItem } from '../../../shared/types'
import UserList from './UserList'
import QueuePanel from './QueuePanel'
import './Player.css'

interface Toast { id: number; message: string; side: 'left' | 'right'; type: 'danger' | 'success' }

export default function Player() {
    const [videoId, setVideoId] = useState('dQw4w9WgXcQ')
    const [urlInput, setUrlInput] = useState('')
    const [joinInput, setJoinInput] = useState('')
    const [toasts, setToasts] = useState<Toast[]>([])
    const [isValidating, setIsValidating] = useState(false)
    const playerRef = useRef<YouTubePlayer | null>(null)
    const prevStateRef = useRef(-1)
    const toastIdRef = useRef(0)
    const pauseEmitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    function addToast(message: string, side: 'left' | 'right', type: 'danger' | 'success' = 'success') {
        const id = ++toastIdRef.current
        setToasts(prev => [...prev, { id, message, side, type }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
    }

    const { isConnected, room, isHost, hasControl, socketId, emitPlay, emitPause, emitSeek, emitChangeVideo, emitChangeName, emitKickUser, emitGrantControl, emitQueueAdd, emitQueueAddBulk, emitQueueClear, emitQueueAdvance, createRoom, joinRoom, leaveRoom } =
        useSync(
            playerRef,
            setVideoId,
            () => addToast('You were kicked from the room', 'left', 'danger'),
            (userName) => addToast(`${userName} left the room`, 'left'),
            () => addToast('Joined the room', 'left'),
            (userName) => addToast(`${userName} joined the room`, 'left'),
        )

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
        if (room) {
            const state = room.playerState
            event.target.seekTo(state.currentTime, true)
            if (!state.isPlaying) event.target.pauseVideo()
        }
    }

    async function handlePlay(event: YouTubeEvent) {
        if (!hasControl) return
        const currentTime = await event.target.getCurrentTime()
        emitPlay(currentTime)
    }

    async function handlePause(event: YouTubeEvent) {
        if (!hasControl) return
        const currentTime = await event.target.getCurrentTime()
        // Delay emission so a seek (state 2→3) can cancel this before it fires
        if (pauseEmitTimeoutRef.current !== null) clearTimeout(pauseEmitTimeoutRef.current)
        pauseEmitTimeoutRef.current = setTimeout(() => {
            pauseEmitTimeoutRef.current = null
            emitPause(currentTime)
        }, 100)
    }

    function handleStateChange(event: YouTubeEvent<number>) {
        if (hasControl && prevStateRef.current === 2 && event.data === 3) {
            // Seeking: cancel the pending pause (it was a seek-pause, not a real pause)
            if (pauseEmitTimeoutRef.current !== null) {
                clearTimeout(pauseEmitTimeoutRef.current)
                pauseEmitTimeoutRef.current = null
            }
            event.target.getCurrentTime().then((t: number) => emitSeek(t))
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

    function handleCreateRoom() {
        createRoom('My Room', '')
    }

    function handleJoinRoom(e: { preventDefault(): void }) {
        e.preventDefault()
        if (!joinInput.trim()) return
        joinRoom(joinInput.trim(), '')
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
                <div className="player-wrapper">
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
                </div>
            </div>

            {inRoom && (
                <div className="right-panel">
                    <UserList
                        room={room}
                        socketId={socketId}
                        onChangeName={emitChangeName}
                        onKick={handleKick}
                        onGrantControl={emitGrantControl}
                    />
                    <QueuePanel queue={room.queue} />
                </div>
            )}

            <div className="bottom-bar">
                {!inRoom ? (
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
                ) : (
                    <div className="room-info">
                        <span
                            className="room-code room-code--clickable"
                            onClick={() => {
                                navigator.clipboard.writeText(room.id)
                                addToast('Room code copied!', 'left')
                            }}
                            title="Click to copy"
                        >Code: <strong>{room.id}</strong></span>
                        <span className="room-status">{isHost ? 'Host' : 'Guest'} · {room.users.length} online</span>
                        <button className="room-btn room-btn--leave" onClick={() => { addToast('Room left', 'left'); leaveRoom() }}>Leave</button>
                    </div>
                )}
                <form className="url-form" onSubmit={handleUrlSubmit}>
                    <input
                        className="url-input"
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        placeholder={inRoom && !hasControl ? 'Only the host can change the video' : 'Paste a YouTube URL or playlist…'}
                        disabled={inRoom && !hasControl}
                    />
                    <button className="url-submit" type="submit" disabled={(inRoom && !hasControl) || isValidating}>
                        {isValidating ? 'Checking…' : 'Load'}
                    </button>
                </form>
                {inRoom && hasControl && (
                    <div className="queue-actions">
                        <button
                            type="button"
                            className="queue-btn"
                            onClick={handleQueueNext}
                            disabled={(!extractVideoId(urlInput) && !extractPlaylistId(urlInput)) || isValidating}
                        >
                            Queue next
                        </button>
                        <button
                            type="button"
                            className="queue-btn"
                            onClick={handleQueueLast}
                            disabled={(!extractVideoId(urlInput) && !extractPlaylistId(urlInput)) || isValidating}
                        >
                            Queue last
                        </button>
                        <button
                            type="button"
                            className="queue-btn queue-btn--clear"
                            onClick={() => emitQueueClear()}
                            disabled={room.queue.length === 0}
                        >
                            Clear queue
                        </button>
                        <button
                            type="button"
                            className="queue-btn queue-btn--skip"
                            onClick={() => emitQueueAdvance()}
                            disabled={room.queue.length === 0}
                        >
                            Skip
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}