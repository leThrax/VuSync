import { io } from 'socket.io-client'

export const SERVER_URL = `http://${window.location.hostname}:3001`
export const socket = io(SERVER_URL, { autoConnect: false })