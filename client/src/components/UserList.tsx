import { useState } from 'react'
import type { Room } from '../../../shared/types'
import './UserList.css'

interface UserListProps {
    room: Room
    socketId: string | undefined
    onChangeName: (name: string) => void
    onKick: (targetId: string) => void
    onGrantControl: (targetId: string) => void
}

export default function UserList({ room, socketId, onChangeName, onKick, onGrantControl }: UserListProps) {
    const currentUserIsHost = room.hostId === socketId
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
                {currentUserIsHost ? 'Host' : 'Guest'} · {room.users.length} online
            </div>
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
            <form className="name-form" onSubmit={handleSubmit}>
                <input
                    className="name-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Change name…"
                />
            </form>
        </div>
    )
}
