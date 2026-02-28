import * as fs from 'fs';
import * as path from 'path';

interface VuSyncConfig {
    server: { port: number };
    client: { port: number };
}

const CONFIG_PATH = path.resolve(__dirname, '../../vusync.config.json');

function loadConfig(): VuSyncConfig {
    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<{ server?: { port?: number }; client?: { port?: number } }>;
        return {
            server: { port: parsed.server?.port ?? 3001 },
            client: { port: parsed.client?.port ?? 5173 },
        };
    } catch {
        console.warn(`[config] Could not read ${CONFIG_PATH}, using defaults.`);
        return {
            server: { port: 3001 },
            client: { port: 5173 },
        };
    }
}

export const config = loadConfig();
