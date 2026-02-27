import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { DEFAULT_PORT } from '../../shared/constants';
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

// Setup WebSocket handlers
setupSocketHandlers(io);

httpServer.listen(DEFAULT_PORT, () => {
    console.log(`🚀 Server running on http://localhost:${DEFAULT_PORT}`);
});