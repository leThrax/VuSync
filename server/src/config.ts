import * as fs from 'fs';
import * as path from 'path';

export interface AdminConfig {
    enabled: boolean;
    networkAccessible: boolean;
    username: string;
    passwordHash: string;
}

export interface VuSyncConfig {
    server: { port: number };
    client: { port: number };
    youtube: { apiKey: string };
    defaultVideoId: string;
    admin: AdminConfig;
}

const CONFIG_PATH = path.resolve(__dirname, '../../vusync.config.json');

function loadConfig(): VuSyncConfig {
    try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<{
            server?: { port?: number };
            client?: { port?: number };
            youtube?: { apiKey?: string };
            defaultVideoId?: string;
        }>;
        const parsedAdmin = (parsed as Partial<{ admin?: Partial<AdminConfig> }>).admin;
        return {
            server: { port: parsed.server?.port ?? 3001 },
            client: { port: parsed.client?.port ?? 5173 },
            youtube: { apiKey: parsed.youtube?.apiKey ?? '' },
            defaultVideoId: parsed.defaultVideoId ?? '',
            admin: {
                enabled: parsedAdmin?.enabled ?? true,
                networkAccessible: parsedAdmin?.networkAccessible ?? false,
                username: parsedAdmin?.username ?? 'admin',
                passwordHash: parsedAdmin?.passwordHash ?? '',
            },
        };
    } catch {
        console.warn(`[config] Could not read ${CONFIG_PATH}, using defaults.`);
        return {
            server: { port: 3001 },
            client: { port: 5173 },
            youtube: { apiKey: '' },
            defaultVideoId: '',
            admin: { enabled: true, networkAccessible: false, username: 'admin', passwordHash: '' },
        };
    }
}

export const config = loadConfig();
