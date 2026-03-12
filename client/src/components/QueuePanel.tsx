import { useState, useRef, useEffect } from 'react'
import { Shuffle, Repeat } from 'lucide-react'
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
    loop?: boolean
    onLoop?: () => void
}

export default function QueuePanel({ queue, hasControl, onRemove, onPlayItem, onReorder, onShuffle, onClear, onSkip, loop, onLoop }: QueuePanelProps) {
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
    const dragIndexRef = useRef<number | null>(null)
    const listRef = useRef<HTMLDivElement | null>(null)
    const [atBottom, setAtBottom] = useState(false)

    function checkAtBottom() {
        const el = listRef.current
        if (!el) return
        setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1)
    }

    useEffect(() => { checkAtBottom() }, [queue])

    const featured = queue[0]
    const rest = queue.slice(1)

    return (
        <div className="queue-panel">
            <div className="queue-panel__header">
                <span>Up next{queue.length > 0 ? ` (${queue.length})` : ''}</span>
                {hasControl && (
                    <div className="queue-header__pill">
                        {onShuffle && queue.length > 1 && (
                            <button
                                className="queue-header__btn"
                                onClick={onShuffle}
                                title="Shuffle queue"
                            ><Shuffle size={13} strokeWidth={2} /></button>
                        )}
                        {onLoop && (
                            <button
                                className={`queue-header__btn${loop ? ' queue-header__btn--active' : ''}`}
                                onClick={onLoop}
                                title={loop ? 'Loop on — click to disable' : 'Loop off — click to enable'}
                            ><Repeat size={13} strokeWidth={2} /></button>
                        )}
                    </div>
                )}
            </div>

            {queue.length === 0 ? (
                <p className="queue-empty">No videos queued</p>
            ) : (
                <div className="queue-panel__body">
                    {/* Featured "up next" card */}
                    <div
                        className={`queue-featured${dragOverIndex === 0 ? ' queue-item--drag-over' : ''}`}
                        draggable={hasControl}
                        onDragStart={() => { dragIndexRef.current = 0 }}
                        onDragOver={e => { e.preventDefault(); setDragOverIndex(0) }}
                        onDragLeave={() => setDragOverIndex(null)}
                        onDrop={e => {
                            e.preventDefault()
                            const from = dragIndexRef.current
                            if (from !== null && from !== 0) onReorder?.(from, 0)
                            setDragOverIndex(null)
                            dragIndexRef.current = null
                        }}
                        onDragEnd={() => { setDragOverIndex(null); dragIndexRef.current = null }}
                    >
                        <div className="queue-featured__thumb-wrap">
                            <img
                                className="queue-featured__thumb"
                                src={`https://img.youtube.com/vi/${featured.videoId}/mqdefault.jpg`}
                                alt=""
                            />
                            {hasControl && (
                                <div className="queue-featured__overlay">
                                    <button
                                        className="queue-item__btn queue-item__btn--play"
                                        onClick={() => onPlayItem?.(0)}
                                        title="Play now"
                                    >▶</button>
                                    <button
                                        className="queue-item__btn queue-item__btn--remove"
                                        onClick={() => onRemove?.(0)}
                                        title="Remove"
                                    >✕</button>
                                </div>
                            )}
                        </div>
                        <p className="queue-featured__title">{featured.title}</p>
                    </div>

                    {/* Compact rest of queue */}
                    {rest.length > 0 && (
                        <>
                            <div className="queue-divider" />
<div className={`queue-list-fade${atBottom ? ' queue-list-fade--bottom' : ''}`}><div className="queue-panel__list" ref={listRef} onScroll={checkAtBottom}>
                                {rest.map((item, i) => (
                                    <div
                                        key={`${item.videoId}-${i + 1}`}
                                        className={`queue-item${dragOverIndex === i + 1 ? ' queue-item--drag-over' : ''}`}
                                        draggable={hasControl}
                                        onDragStart={() => { dragIndexRef.current = i + 1 }}
                                        onDragOver={e => { e.preventDefault(); setDragOverIndex(i + 1) }}
                                        onDragLeave={() => setDragOverIndex(null)}
                                        onDrop={e => {
                                            e.preventDefault()
                                            const from = dragIndexRef.current
                                            if (from !== null && from !== i + 1) onReorder?.(from, i + 1)
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
                                                    onClick={() => onPlayItem?.(i + 1)}
                                                    title="Play now"
                                                >▶</button>
                                                <button
                                                    className="queue-item__btn queue-item__btn--remove"
                                                    onClick={() => onRemove?.(i + 1)}
                                                    title="Remove"
                                                >✕</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div></div>
                        </>
                    )}
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
