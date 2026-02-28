import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config';
import { setupSocketHandlers } from './socket/handlers';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: true, // allow all origins in dev
        methods: ['GET', 'POST'],
    },
});

// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
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

// Fetch playlist items via YouTube's public RSS/Atom feed (no API key needed)
app.get('/api/playlist/:playlistId', async (req, res) => {
    const { playlistId } = req.params;
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

// Setup WebSocket handlers
setupSocketHandlers(io);

httpServer.listen(config.server.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.server.port}`);
});