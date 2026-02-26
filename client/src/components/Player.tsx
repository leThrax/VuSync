import { useRef, useState } from 'react'
import YouTube from 'react-youtube'
import type { YouTubeEvent } from 'react-youtube'
import type { YouTubePlayer } from 'react-youtube'
import { useSync } from '../hooks/useSync'
import './Player.css'

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

function randomName(): string {
    return 'User' + Math.floor(Math.random() * 9000 + 1000)
}

export default function Player() {
    const [videoId, setVideoId] = useState('dQw4w9WgXcQ')
    const [urlInput, setUrlInput] = useState('')
    const [joinInput, setJoinInput] = useState('')
    const playerRef = useRef<YouTubePlayer | null>(null)
    const prevStateRef = useRef(-1)
    const userNameRef = useRef(randomName())

    const { isConnected, room, isHost, emitPlay, emitPause, emitSeek, emitChangeVideo, createRoom, joinRoom } =
        useSync(playerRef, setVideoId)

    function handleReady(event: YouTubeEvent) {
        playerRef.current = event.target
        if (room) {
            const state = room.playerState
            event.target.seekTo(state.currentTime, true)
            if (!state.isPlaying) event.target.pauseVideo()
        }
    }

    async function handlePlay(event: YouTubeEvent) {
        if (!isHost) return
        const currentTime = await event.target.getCurrentTime()
        emitPlay(currentTime)
    }

    async function handlePause(event: YouTubeEvent) {
        if (!isHost) return
        const currentTime = await event.target.getCurrentTime()
        emitPause(currentTime)
    }

    function handleStateChange(event: YouTubeEvent<number>) {
        if (isHost && prevStateRef.current === 2 && event.data === 3) {
            event.target.getCurrentTime().then((t: number) => emitSeek(t))
        }
        prevStateRef.current = event.data
    }

    function handleUrlSubmit(e: { preventDefault(): void }) {
        e.preventDefault()
        const id = extractVideoId(urlInput)
        if (!id) return
        setUrlInput('')
        if (room && isHost) {
            emitChangeVideo(id)
            setVideoId(id)
        } else if (!room) {
            setVideoId(id)
        }
    }

    function handleCreateRoom() {
        createRoom('Room ' + userNameRef.current, userNameRef.current)
    }

    function handleJoinRoom(e: { preventDefault(): void }) {
        e.preventDefault()
        if (!joinInput.trim()) return
        joinRoom(joinInput.trim(), userNameRef.current)
        setJoinInput('')
    }

    const inRoom = room !== null

    return (
        <div className="player-layout">
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
                    </div>
                )}
                <form className="url-form" onSubmit={handleUrlSubmit}>
                    <input
                        className="url-input"
                        value={urlInput}
                        onChange={e => setUrlInput(e.target.value)}
                        placeholder={inRoom && !isHost ? 'Only the host can change the video' : 'Paste a YouTube URL…'}
                        disabled={inRoom && !isHost}
                    />
                    <button className="url-submit" type="submit" disabled={inRoom && !isHost}>
                        Load
                    </button>
                </form>
            </div>
        </div>
    )
}