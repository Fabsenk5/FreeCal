import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
// import eventRoutes from './routes/eventRoutes'; // TODO
import { db } from './db';
import { sql } from 'drizzle-orm';
import { warmUpPool, pingDatabase } from './db/connectionPool';


dotenv.config();

// Keep-alive mechanism to prevent DB sleep (and keep Events table warm)
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
setInterval(performKeepAlive, KEEP_ALIVE_INTERVAL);

// Warm up the connection pool on startup
warmUpPool().then(() => {
    console.log('[Server] Database connection pool ready');
});

// Initial keep-alive check
performKeepAlive();


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
        // Don't log passwords
        const body = { ...req.body };
        if (body.password) body.password = '***';
        console.log('Body:', JSON.stringify(body));
    }
    next();
});

// Routes
app.use('/api/auth', authRoutes);
import apiRoutes from './routes/apiRoutes';
app.use('/api', apiRoutes);

// Enhanced health endpoint with DB validation
app.get('/health', async (req, res) => {
    const startTime = Date.now();
    const dbAlive = await pingDatabase();
    const responseTime = Date.now() - startTime;

    res.json({
        status: 'ok',
        database: dbAlive ? 'connected' : 'error',
        uptime: process.uptime(),
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
