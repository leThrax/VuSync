// Socket.IO event names — single source of truth
export const EVENTS = {
    // Room management
    CREATE_ROOM: 'room:create',
    JOIN_ROOM: 'room:join',
    LEAVE_ROOM: 'room:leave',
    ROOM_UPDATE: 'room:update',

    // Playback sync
    SYNC_STATE: 'sync:state',
    PLAY: 'sync:play',
    PAUSE: 'sync:pause',
    SEEK: 'sync:seek',
    CHANGE_VIDEO: 'sync:changeVideo',

    // Chat
    CHAT_MESSAGE: 'chat:message',

    // Connection
    USER_JOINED: 'user:joined',
    USER_LEFT: 'user:left',
} as const;

export const DEFAULT_PORT = 3001;