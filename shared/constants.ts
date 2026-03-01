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

    // Queue
    QUEUE_ADD: 'queue:add',
    QUEUE_ADD_BULK: 'queue:addBulk',
    QUEUE_CLEAR: 'queue:clear',
    QUEUE_ADVANCE: 'queue:advance',
    QUEUE_REMOVE: 'queue:remove',
    QUEUE_PLAY_ITEM: 'queue:playItem',

    // Chat
    CHAT_MESSAGE: 'chat:message',

    // Connection
    USER_JOINED: 'user:joined',
    USER_LEFT: 'user:left',
    CHANGE_NAME: 'user:changeName',
    KICK_USER: 'user:kick',
    KICKED: 'user:kicked',
    GRANT_CONTROL: 'user:grantControl',
} as const;

export const DEFAULT_PORT = 3001;