import * as fs from 'fs'
import * as path from 'path'

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
    ts: number
    level: LogLevel
    msg: string
}

const LOG_DIR = path.join(__dirname, '..', 'logs')
const MAX_BUFFER = 500
const logBuffer: LogEntry[] = []

function getLogFilePath(): string {
    const d = new Date()
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return path.join(LOG_DIR, `vusync-${date}.log`)
}

function ensureLogDir(): void {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true })
    }
}

function write(level: LogLevel, msg: string): void {
    const ts = Date.now()
    const iso = new Date(ts).toISOString()
    const line = `[${iso}] [${level.toUpperCase()}] ${msg}`

    // Console output
    if (level === 'error') {
        console.error(line)
    } else if (level === 'warn') {
        console.warn(line)
    } else {
        console.log(line)
    }

    // File output
    try {
        ensureLogDir()
        fs.appendFileSync(getLogFilePath(), line + '\n', 'utf8')
    } catch {
        // Silently fail — don't crash the server over logging errors
    }

    // In-memory buffer
    logBuffer.push({ ts, level, msg })
    if (logBuffer.length > MAX_BUFFER) {
        logBuffer.shift()
    }
}

export const logger = {
    info: (msg: string) => write('info', msg),
    warn: (msg: string) => write('warn', msg),
    error: (msg: string) => write('error', msg),
}

export function getLogBuffer(n = 200): LogEntry[] {
    return logBuffer.slice(-n)
}

export function getLogFilePath_export(): string {
    return getLogFilePath()
}
