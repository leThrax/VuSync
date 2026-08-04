import { io } from 'socket.io-client'

declare const __SERVER_PORT__: number

export const SERVER_URL = import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:${__SERVER_PORT__}`
    : window.location.origin

export const socket = io(SERVER_URL, { autoConnect: false })

const CLIENT_ID_KEY = 'vusync-client-id'
export const CLIENT_ID = localStorage.getItem(CLIENT_ID_KEY) ?? (() => {
    const id = crypto.randomUUID()
    localStorage.setItem(CLIENT_ID_KEY, id)
    return id
})()
