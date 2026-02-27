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

// Setup WebSocket handlers
setupSocketHandlers(io);

httpServer.listen(DEFAULT_PORT, () => {
    console.log(`🚀 Server running on http://localhost:${DEFAULT_PORT}`);
});