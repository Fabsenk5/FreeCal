import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import apiRoutes from './routes/apiRoutes';
import { db } from './db';
import { sql } from 'drizzle-orm';
import { warmUpPool, pingDatabase, closePool } from './db/connectionPool';


dotenv.config();

// Keep-alive mechanism to prevent DB sleep (uses the shared pool via drizzle)
const performKeepAlive = async () => {
    try {
        console.log(`[${new Date().toISOString()}] Performing DB keep-alive check...`);
        // Simple ping to keep connection alive
        await db.execute(sql`SELECT 1`);
        console.log(`[${new Date().toISOString()}] DB keep-alive check successful`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] DB keep-alive check failed:`, error);
    }
};

// Run every 14 minutes (keeps Render awake, but allows Neon to sleep)
const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000;
const keepAliveTimer = setInterval(performKeepAlive, KEEP_ALIVE_INTERVAL);

// Warm up the connection pool on startup
warmUpPool().then(() => {
    console.log('[Server] Database connection pool ready');
});

// Initial keep-alive check
performKeepAlive();


const app = express();
const PORT = process.env.PORT || 3000;

// CORS: restrict to the configured frontend origin (plus local dev).
// If FRONTEND_URL is not set, CORS stays open (previous behavior) but we warn loudly.
if (!process.env.FRONTEND_URL) {
    console.warn('[Server] FRONTEND_URL is not set - CORS allows ALL origins. Set FRONTEND_URL to your production frontend origin.');
    app.use(cors());
} else {
    const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:5173'];
    app.use(cors({
        origin: (origin, callback) => {
            // Allow non-browser requests (no Origin header: curl, health checks, server-to-server)
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`Origin ${origin} not allowed by CORS`));
            }
        },
    }));
}
app.use(express.json());

// Request Logger
const SENSITIVE_BODY_FIELDS = ['password', 'newPassword', 'token', 'resetToken'];
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
        // Mask sensitive fields before logging
        const body = { ...req.body };
        for (const field of SENSITIVE_BODY_FIELDS) {
            if (body[field]) body[field] = '***';
        }
        console.log('Body:', JSON.stringify(body));
    }
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Enhanced health endpoint with DB validation
app.get('/health', async (req, res) => {
    const startTime = Date.now();
    const dbAlive = await pingDatabase();
    const responseTime = Date.now() - startTime;

    res.status(dbAlive ? 200 : 503).json({
        status: 'ok',
        database: dbAlive ? 'connected' : 'error',
        uptime: process.uptime(),
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
    });
});

// JSON error middleware (must be registered AFTER the routes):
// returns a generic message to clients, details go to the server log only.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[${new Date().toISOString()}] Unhandled error on ${req.method} ${req.path}:`, err);
    if (res.headersSent) return next(err);
    const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(status).json({ error: status === 500 ? 'Internal server error' : String(err?.message || 'Request failed') });
});

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown: stop accepting connections, drain, close the DB pool.
const SHUTDOWN_TIMEOUT_MS = 10 * 1000;
const shutdown = (signal: string) => {
    console.log(`[Server] ${signal} received, shutting down gracefully...`);
    clearInterval(keepAliveTimer);

    const forceExit = setTimeout(() => {
        console.error('[Server] Graceful shutdown timed out, forcing exit');
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close(async () => {
        await closePool();
        console.log('[Server] Shutdown complete');
        process.exit(0);
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled promise rejection:', reason);
});
