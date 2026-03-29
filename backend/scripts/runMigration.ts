/**
 * Run the Supabase migration SQL against the target database.
 * Usage: npx tsx scripts/runMigration.ts
 */
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config();

async function runMigration() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not set in backend/.env');
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const sqlPath = path.join(__dirname, '..', '..', 'supabase', 'migration.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('Connecting to Supabase...');
    
    try {
        await pool.query('SELECT 1');
        console.log('Connected successfully.');
        
        console.log('Running migration SQL...');
        await pool.query(sql);
        console.log('Migration completed successfully!');
        
        // Verify tables
        const result = await pool.query(`
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        console.log('Tables created:', result.rows.map(r => r.table_name));
    } catch (err) {
        console.error('Migration error:', err);
        throw err;
    } finally {
        await pool.end();
    }
}

runMigration();
