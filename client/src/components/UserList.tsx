import { useState } from 'react'
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
                        <span className="user-entry__name">{currentName || 'Anonymous'}</span>
                        <div className="user-entry__badges">
                            <span className="badge badge--you">YOU</span>
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
                                className={`user-entry${isMe ? ' user-entry--me' : ''}${user.canControl ? ' user-entry--ctrl' : ''}`}
                                onClick={currentUserIsHost && !isMe && !isHost ? () => onGrantControl(user.id) : undefined}
                                style={currentUserIsHost && !isMe && !isHost ? { cursor: 'pointer' } : undefined}
                                title={currentUserIsHost && !isMe && !isHost ? (user.canControl ? 'Revoke control' : 'Grant control') : undefined}
                            >
                                <span className="user-entry__name">{user.name}</span>
                                <div className="user-entry__badges">
                                    {isHost && <span className="badge badge--host">HOST</span>}
                                    {user.canControl && <span className="badge badge--ctrl">CTRL</span>}
                                    {isMe && <span className="badge badge--you">YOU</span>}
                                    {currentUserIsHost && !isMe && (
                                        <button className="kick-btn" onClick={e => { e.stopPropagation(); onKick(user.id) }} title="Kick">❌</button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
            <form className="name-form" onSubmit={handleSubmit}>
                <input
                    className="name-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={room === null ? 'Set name…' : 'Change name…'}
                />
            </form>
        </div>
    )
}
