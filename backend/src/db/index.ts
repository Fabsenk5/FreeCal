import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set. Database connection will fail.');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Helper to prevent app crash on idle client connection loss
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
    // Don't exit the process, just log the error. 
    // The pool will handle removing the client.
});

export const db = drizzle(pool, { schema });
