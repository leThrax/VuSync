import { io } from 'socket.io-client'

declare const __SERVER_PORT__: number

export const SERVER_URL = import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:${__SERVER_PORT__}`
    : window.location.origin

export const socket = io(SERVER_URL, { autoConnect: false })
