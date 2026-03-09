import { useState } from 'react'
import { Zap, Gamepad2 } from 'lucide-react'
import type { Room } from '../../../shared/types'
import './UserList.css'

interface UserListProps {
    room: Room | null
    socketId: string | undefined
    currentName: string
    onChangeName: (name: string) => void
    onKick: (targetId: string) => void
    onGrantControl: (targetId: string) => void
}

export default function UserList({ room, socketId, currentName, onChangeName, onKick, onGrantControl }: UserListProps) {
    const currentUserIsHost = room !== null && room.hostId === socketId
    const [input, setInput] = useState('')

    function handleSubmit(e: { preventDefault(): void }) {
        e.preventDefault()
        const trimmed = input.trim()
        if (!trimmed) return
        onChangeName(trimmed)
        setInput('')
    }

    return (
        <div className="user-list">
            <div className="user-list__status">
                {room === null
                    ? 'Not in a room'
                    : `${currentUserIsHost ? 'Host' : 'Guest'} · ${room.users.length} online`}
            </div>
            {room === null && (
                <div className="user-list__entries">
                    <div className="user-entry user-entry--me">
                        <div className="user-entry__left">
                            <span className="user-dot" />
                            <span className="user-entry__name">{currentName || 'Anonymous'}</span>
                        </div>
                    </div>
                </div>
            )}
            {room !== null && (
                <div className="user-list__entries">
                    {room.users.map(user => {
                        const isHost = user.id === room.hostId
                        const isMe = user.id === socketId
                        return (
                            <div
                                key={user.id}
                                className={`user-entry${isMe ? ' user-entry--me' : ''}${isHost ? ' user-entry--host' : ''}${user.canControl && !isHost ? ' user-entry--ctrl' : ''}`}
                                onClick={currentUserIsHost && !isMe && !isHost ? () => onGrantControl(user.id) : undefined}
                                style={currentUserIsHost && !isMe && !isHost ? { cursor: 'pointer' } : undefined}
                                title={currentUserIsHost && !isMe && !isHost ? (user.canControl ? 'Revoke control' : 'Grant control') : undefined}
                            >
                                <div className="user-entry__left">
                                    {isMe && <span className="user-dot" />}
                                    <span className="user-entry__name">{user.name}</span>
                                </div>
                                <div className="user-entry__right">
                                    {isHost && <span className="badge badge--host"><Zap size={11} strokeWidth={2} /></span>}
                                    {user.canControl && !isHost && <span className="badge badge--ctrl"><Gamepad2 size={11} strokeWidth={2} /></span>}
                                    {currentUserIsHost && !isMe && (
                                        <button className="kick-btn" onClick={e => { e.stopPropagation(); onKick(user.id) }} title="Kick">❌</button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
            {room !== null && (
                <form className="name-form" onSubmit={handleSubmit}>
                    <input
                        className="name-input"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Change name…"
                    />
                </form>
            )}
        </div>
    )
}
