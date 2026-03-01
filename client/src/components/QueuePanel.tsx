import type { QueueItem } from '../../../shared/types'
import './QueuePanel.css'

interface QueuePanelProps {
    queue: QueueItem[]
    hasControl?: boolean
    onRemove?: (index: number) => void
    onPlayItem?: (index: number) => void
}

export default function QueuePanel({ queue, hasControl, onRemove, onPlayItem }: QueuePanelProps) {
    return (
        <div className="queue-panel">
            <div className="queue-panel__header">
                <span>Up next{queue.length > 0 ? ` (${queue.length})` : ''}</span>
            </div>
            {queue.length === 0 ? (
                <p className="queue-empty">Queue is empty</p>
            ) : (
                <div className="queue-panel__list">
                    {queue.map((item, i) => (
                        <div key={`${item.videoId}-${i}`} className="queue-item">
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
        </div>
    )
}
