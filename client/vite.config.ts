import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as fs from 'fs'
import * as path from 'path'

function loadConfig(): { serverPort: number; clientPort: number } {
    const configPath = path.resolve(__dirname, '../vusync.config.json')
    try {
        const raw = fs.readFileSync(configPath, 'utf-8')
        const parsed = JSON.parse(raw) as { server?: { port?: number }; client?: { port?: number } }
        return {
            serverPort: parsed.server?.port ?? 3001,
            clientPort: parsed.client?.port ?? 5173,
        }
    } catch {
        return { serverPort: 3001, clientPort: 5173 }
    }
}

const { serverPort, clientPort } = loadConfig()

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        // Prefer .ts source over compiled .js so Vite picks up shared/*.ts instead of shared/*.js
        extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
    },
    server: {
        port: clientPort,
        fs: {
            // Allow importing from the monorepo root (shared/)
            allow: ['..'],
        },
    },
    define: {
        __SERVER_PORT__: serverPort,
    },
})
