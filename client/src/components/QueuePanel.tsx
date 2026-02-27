import type { QueueItem } from '../../../shared/types'
import './QueuePanel.css'

interface QueuePanelProps {
    queue: QueueItem[]
}

export default function QueuePanel({ queue }: QueuePanelProps) {
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
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}