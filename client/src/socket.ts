import { io } from 'socket.io-client'

declare const __SERVER_PORT__: number

export const SERVER_URL = `http://${window.location.hostname}:${__SERVER_PORT__}`
export const socket = io(SERVER_URL, { autoConnect: false })
