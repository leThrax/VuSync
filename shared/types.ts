// ---- Shared types used by both client and server ----

export interface QueueItem {
    videoId: string;
    title: string;
}

export interface User {
    id: string;
    name: string;
    roomId?: string;
    canControl?: boolean;
}

export interface Room {
    id: string;
    name: string;
    hostId: string;
    videoUrl: string;
    users: User[];
    playerState: PlayerState;
    queue: QueueItem[]; // ordered list of queued videos
}

export interface PlayerState {
    isPlaying: boolean;
    currentTime: number;    // seconds
    videoId: string;
    lastUpdated: number;    // timestamp
}

// Socket.IO event payloads
export interface SyncEvent {
    roomId: string;
    playerState: PlayerState;
}

export interface ChatMessage {
    userId: string;
    userName: string;
    message: string;
    timestamp: number;
}