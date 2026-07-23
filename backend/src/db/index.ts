import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
import * as dotenv from 'dotenv';
import { pool } from './connectionPool';

dotenv.config();

if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set. Database connection will fail.');
}

// Reuse the single tuned pool from connectionPool.ts so Drizzle queries,
// keep-alive pings and the health check all share the same connections.
export const db = drizzle(pool, { schema });
