import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
// import eventRoutes from './routes/eventRoutes'; // TODO
import { db } from './db';
import { sql } from 'drizzle-orm';


dotenv.config();

// Keep-alive mechanism to prevent DB sleep (and keep Events table warm)
const performKeepAlive = async () => {
    try {
        console.log(`[${new Date().toISOString()}] Performing DB keep-alive check...`);
        // Query events table to keep it warm/cached in memory if possible
        await db.execute(sql`SELECT count(*) FROM events`);
        console.log(`[${new Date().toISOString()}] DB keep-alive (Events table) check successful`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] DB keep-alive check failed:`, error);
    }
};

// Run every 5 minutes
const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000;
setInterval(performKeepAlive, KEEP_ALIVE_INTERVAL);

// Initial check
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
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
