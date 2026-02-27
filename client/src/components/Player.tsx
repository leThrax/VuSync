import { useRef, useState } from 'react'
import YouTube from 'react-youtube'
import type { YouTubeEvent } from 'react-youtube'
import type { YouTubePlayer } from 'react-youtube'
import { useSync } from '../hooks/useSync'
import UserList from './UserList'
import './Player.css'

interface Toast { id: number; message: string; side: 'left' | 'right'; type: 'danger' | 'success' }

function extractVideoId(url: string): string | null {
    const patterns = [
        /[?&]v=([^&#]+)/,
        /youtu\.be\/([^&#?/]+)/,
        /\/embed\/([^&#?/]+)/,
    ]
    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1]
    }
    return null
}

export default function Player() {
    const [videoId, setVideoId] = useState('dQw4w9WgXcQ')
    const [urlInput, setUrlInput] = useState('')
    const [joinInput, setJoinInput] = useState('')
    const [toasts, setToasts] = useState<Toast[]>([])
    const playerRef = useRef<YouTubePlayer | null>(null)
    const prevStateRef = useRef(-1)
    const toastIdRef = useRef(0)
    const pauseEmitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    function addToast(message: string, side: 'left' | 'right', type: 'danger' | 'success' = 'success') {
        const id = ++toastIdRef.current
        setToasts(prev => [...prev, { id, message, side, type }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
    }

    const { isConnected, room, isHost, hasControl, socketId, emitPlay, emitPause, emitSeek, emitChangeVideo, emitChangeName, emitKickUser, emitGrantControl, createRoom, joinRoom, leaveRoom } =
        useSync(playerRef, setVideoId, () => addToast('You were kicked from the room', 'left', 'danger'))

    function handleKick(targetId: string) {
        emitKickUser(targetId)
        addToast('User kicked successfully', 'left')
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

    function handleUrlSubmit(e: { preventDefault(): void }) {
        e.preventDefault()
        const id = extractVideoId(urlInput)
        if (!id) return
        setUrlInput('')
        if (room) {
            emitChangeVideo(id)
            setVideoId(id)
        } else {
            setVideoId(id)
        }
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
                    />
                </div>
            </div>

            {inRoom && (
                <UserList
                    room={room}
                    socketId={socketId}
                    onChangeName={emitChangeName}
                    onKick={handleKick}
                    onGrantControl={emitGrantControl}
                />
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
                        <span className="room-code">Code: <strong>{room.id}</strong></span>
                        <span className="room-status">{isHost ? 'Host' : 'Guest'} · {room.users.length} online</span>
                        <button className="room-btn room-btn--leave" onClick={leaveRoom}>Leave</button>
                    </div>
                )}
                <form className="url-form" onSubmit={handleUrlSubmit}>
                    <input
                        className="url-input"
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        placeholder={inRoom && !hasControl ? 'Only the host can change the video' : 'Paste a YouTube URL…'}
                        disabled={inRoom && !hasControl}
                    />
                    <button className="url-submit" type="submit" disabled={inRoom && !hasControl}>
                        Load
                    </button>
                </form>
            </div>
        </div>
    )
}
