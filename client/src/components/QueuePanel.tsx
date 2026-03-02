import { useState, useRef } from 'react'
import type { QueueItem } from '../../../shared/types'
import './QueuePanel.css'

interface QueuePanelProps {
    queue: QueueItem[]
    hasControl?: boolean
    onRemove?: (index: number) => void
    onPlayItem?: (index: number) => void
    onReorder?: (fromIndex: number, toIndex: number) => void
    onShuffle?: () => void
    onClear?: () => void
    onSkip?: () => void
}

export default function QueuePanel({ queue, hasControl, onRemove, onPlayItem, onReorder, onShuffle, onClear, onSkip }: QueuePanelProps) {
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
    const dragIndexRef = useRef<number | null>(null)

    return (
        <div className="queue-panel">
            <div className="queue-panel__header">
                <span>Up next{queue.length > 0 ? ` (${queue.length})` : ''}</span>
                {hasControl && onShuffle && queue.length > 1 && (
                    <button
                        className="queue-header__shuffle-btn"
                        onClick={onShuffle}
                        title="Shuffle queue"
                    >⇄</button>
                )}
            </div>
            {queue.length === 0 ? (
                <p className="queue-empty">Queue is empty</p>
            ) : (
                <div className="queue-panel__list">
                    {queue.map((item, i) => (
                        <div
                            key={`${item.videoId}-${i}`}
                            className={`queue-item${dragOverIndex === i ? ' queue-item--drag-over' : ''}`}
                            draggable={hasControl}
                            onDragStart={() => { dragIndexRef.current = i }}
                            onDragOver={e => { e.preventDefault(); setDragOverIndex(i) }}
                            onDragLeave={() => setDragOverIndex(null)}
                            onDrop={e => {
                                e.preventDefault()
                                const from = dragIndexRef.current
                                if (from !== null && from !== i) onReorder?.(from, i)
                                setDragOverIndex(null)
                                dragIndexRef.current = null
                            }}
                            onDragEnd={() => { setDragOverIndex(null); dragIndexRef.current = null }}
                        >
                            <img
                                className="queue-item__thumb"
                                src={`https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`}
                                alt=""
                            />
                            <span className="queue-item__title">{item.title}</span>
                            {hasControl && (
                                <div className="queue-item__actions">
                                    <button
                                        className="queue-item__btn queue-item__btn--play"
                                        onClick={() => onPlayItem?.(i)}
                                        title="Play now"
                                    >▶</button>
                                    <button
                                        className="queue-item__btn queue-item__btn--remove"
                                        onClick={() => onRemove?.(i)}
                                        title="Remove"
                                    >✕</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            {hasControl && (onClear || onSkip) && queue.length > 0 && (
                <div className="queue-panel__footer">
                    <button
                        className="queue-panel__footer-btn queue-panel__footer-btn--skip"
                        onClick={onSkip}
                        title="Skip to next"
                    >Skip</button>
                    <button
                        className="queue-panel__footer-btn queue-panel__footer-btn--clear"
                        onClick={onClear}
                        title="Clear queue"
                    >Clear queue</button>
                </div>
            )}
        </div>
    )
}
