import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import session from 'express-session';
import { config } from './config';
import { setupSocketHandlers } from './socket/handlers';
import { createAdminRouter } from './routes/admin';
import { createAdminGate } from './admin/auth';

const isProd = process.env.NODE_ENV === 'production';
const startTime = Date.now();

const app = express();
app.use(isProd ? cors({ origin: false }) : cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: isProd
        ? { origin: false }
        : { origin: true, methods: ['GET', 'POST'] },
});

// Serve built client in production
if (isProd) {
    const clientDist = path.join(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
}

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Client-safe config (never exposes the YouTube API key)
app.get('/api/config', (_req, res) => {
    res.json({ defaultVideoId: config.defaultVideoId });
});

// Validate a YouTube video ID by proxying YouTube's oEmbed API
app.get('/api/check-video/:videoId', async (req, res) => {
    const { videoId } = req.params;
    try {
        const oEmbedRes = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`
        );
        res.json({ available: oEmbedRes.ok });
    } catch {
        res.json({ available: false });
    }
});

// Fetch playlist items — uses YouTube Data API v3 if an apiKey is configured
// (full pagination, no 15-video cap), otherwise falls back to the public RSS feed.
app.get('/api/playlist/:playlistId', async (req, res) => {
    const { playlistId } = req.params;

    // --- Strategy A: YouTube Data API v3 (requires apiKey) ---
    if (config.youtube.apiKey) {
        try {
            const videos: { videoId: string; title: string }[] = [];
            let pageToken: string | undefined;

            do {
                const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
                url.searchParams.set('part', 'snippet');
                url.searchParams.set('maxResults', '50');
                url.searchParams.set('playlistId', playlistId);
                url.searchParams.set('key', config.youtube.apiKey);
                if (pageToken) url.searchParams.set('pageToken', pageToken);

                const apiRes = await fetch(url.toString());

                // Bad key, quota exceeded, or other API error — fall through to RSS
                if (!apiRes.ok) break;

                const data = await apiRes.json() as {
                    items: { snippet: { title: string; resourceId: { videoId: string } } }[];
                    nextPageToken?: string;
                };

                for (const item of data.items) {
                    const title = item.snippet.title;
                    // Skip deleted/private placeholders
                    if (title === 'Deleted video' || title === 'Private video') continue;
                    videos.push({ videoId: item.snippet.resourceId.videoId, title });
                }

                pageToken = data.nextPageToken;
            } while (pageToken);

            if (videos.length > 0) {
                res.json({ available: true, videos });
                return;
            }
            // If we got 0 usable videos (e.g. all private) also fall through to RSS
        } catch {
            // Network/parse error — fall through to RSS
        }
    }

    // --- Strategy B: public RSS/Atom feed fallback (≤15 videos, no key needed) ---
    try {
        const feedRes = await fetch(
            `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`
        );
        if (!feedRes.ok) {
            res.json({ available: false, videos: [] });
            return;
        }
        const xml = await feedRes.text();
        const videos: { videoId: string; title: string }[] = [];
        const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
        let match;
        while ((match = entryRegex.exec(xml)) !== null) {
            const entry = match[1];
            const videoIdMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
            const titleMatch = entry.match(/<title>(.*?)<\/title>/);
            if (videoIdMatch && titleMatch) {
                const title = titleMatch[1]
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'");
                videos.push({ videoId: videoIdMatch[1], title });
            }
        }
        res.json({ available: videos.length > 0, videos });
    } catch {
        res.json({ available: false, videos: [] });
    }
});

// Admin panel
if (config.admin.networkAccessible && !config.admin.passwordHash) {
    console.warn('[admin] networkAccessible is true but passwordHash is not set — admin panel disabled.');
    config.admin.enabled = false;
}
if (config.admin.enabled) {
    app.use(session({
        secret: crypto.randomBytes(32).toString('hex'),
        resave: false,
        saveUninitialized: false,
        cookie: { httpOnly: true, sameSite: 'strict', secure: isProd, maxAge: 8 * 60 * 60 * 1000 },
    }));
    const adminGate = createAdminGate(config.admin);
    const adminRouter = createAdminRouter(config, startTime);
    app.use('/admin', adminGate, adminRouter);
    console.log(`[admin] Panel available at http://localhost:${config.server.port}/admin`);
}

// Setup WebSocket handlers
setupSocketHandlers(io);

// SPA fallback — must come after all API routes
if (isProd) {
    const clientDist = path.join(__dirname, '../../client/dist');
    app.use((_req, res) => {
        res.sendFile(path.join(clientDist, 'index.html'));
    });
}

httpServer.listen(config.server.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.server.port}`);
});