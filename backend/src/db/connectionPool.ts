import { Pool, PoolConfig } from 'pg';

/**
 * Optimized connection pool for Neon PostgreSQL
 * 
 * Configured for cold start resilience:
 * - Smaller pool size for free tier limits
 * - Connection timeout with retry
 * - Keep-alive settings to maintain connections
 */

const poolConfig: PoolConfig = {
    connectionString: process.env.DATABASE_URL,

    // Pool size - keep small for free tier
    max: 5, // Maximum 5 connections
    min: 1, // Keep at least 1 connection warm

    // Pool timeout settings
    connectionTimeoutMillis: 30000, // 30s to allow for cold start
    idleTimeoutMillis: 30000, // Close idle connections after 30s

    // Keep-alive to prevent connection drop
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000, // Start keep-alive after 10s

    // Statement timeout (prevent long-running queries)
    statement_timeout: 30000, // 30s query timeout

    // Query timeout
    query_timeout: 30000,
};

/* 
// --- SUPABASE CONFIGURATION (Uncomment to switch) ---
// const poolConfig: PoolConfig = {
//     connectionString: process.env.DATABASE_URL,
//     
//     // Supabase Transaction Pooler (Port 6543) Settings
//     // Transaction mode handles connections efficiently, so we disable keep-alive and allow smaller/zero min pool
//     max: 10,
//     min: 0,
//     connectionTimeoutMillis: 30000,
//     idleTimeoutMillis: 60000,
//     ssl: { rejectUnauthorized: false } // Required for Supabase
// };
*/

// Create the pool
export const pool = new Pool(poolConfig);

// Error handling
pool.on('error', (error) => {
    console.error('[DB Pool] Unexpected error:', error);
});

pool.on('connect', () => {
    console.log('[DB Pool] New client connected');
});

pool.on('remove', () => {
    console.log('[DB Pool] Client removed from pool');
});

/**
 * Warm up the connection pool on server start
 * This helps reduce cold start latency
 */
export const warmUpPool = async (): Promise<void> => {
    try {
        console.log('[DB Pool] Warming up connection pool...');
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log('[DB Pool] Pool warmed up successfully');
    } catch (error) {
        console.error('[DB Pool] Failed to warm up pool:', error);
        // Don't throw - server can still start
    }
};

/**
 * Execute a simple query to keep the database connection alive
 * Called by the health endpoint
 */
export const pingDatabase = async (): Promise<boolean> => {
    try {
        const result = await pool.query('SELECT 1 as alive');
        return result.rows[0]?.alive === 1;
    } catch (error) {
        console.error('[DB Pool] Database ping failed:', error);
        return false;
    }
};

/**
 * Gracefully close all connections
 */
export const closePool = async (): Promise<void> => {
    try {
        await pool.end();
        console.log('[DB Pool] All connections closed');
    } catch (error) {
        console.error('[DB Pool] Error closing pool:', error);
    }
};
