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
    users: User[];
    playerState: PlayerState;
    queue: QueueItem[]; // ordered list of queued videos
    hasPassword?: boolean;
    loop?: boolean;
    permanent?: boolean;
}

export interface PlayerState {
    isPlaying: boolean;
    currentTime: number;    // seconds
    videoId: string;
    lastUpdated: number;    // timestamp
}

export interface ChatMessage {
    userId: string;
    userName: string;
    message: string;
    timestamp: number;
}