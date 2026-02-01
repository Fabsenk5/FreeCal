
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

async function migrateData() {
    console.log('Starting migration from Neon to Supabase check...');

    if (!process.env.NEON_DATABASE_URL) {
        throw new Error('NEON_DATABASE_URL is missing!');
    }
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is missing!');
    }

    // Explicit SSL for Neon to be safe
    const neonPool = new Pool({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    // Explicit SSL for Supabase
    const supabasePool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const tables = [
        'profiles',
        'feature_wishes',
        'travel_locations',
        'events',
        'event_attendees',
        'event_viewers',
        'relationships'
    ];

    try {
        console.log('Testing Neon connection...');
        await neonPool.query('SELECT 1');
        console.log('Neon connection OK.');

        console.log('Testing Supabase connection...');
        await supabasePool.query('SELECT 1');
        console.log('Supabase connection OK.');

        for (const table of tables) {
            console.log(`Migrating table: ${table}...`);

            try {
                // 1. Fetch data from Neon
                console.log(`  Fetching from ${table}...`);
                const sourceRes = await neonPool.query(`SELECT * FROM "${table}"`);
                const rows = sourceRes.rows;

                if (rows.length === 0) {
                    console.log(`  No data in ${table}, skipping.`);
                    continue;
                }
                console.log(`  Found ${rows.length} rows in ${table}.`);

                // 2. Insert into Supabase
                console.log(`  Inserting into Supabase...`);
                for (const row of rows) {
                    const keys = Object.keys(row).map(key => `"${key}"`).join(', ');
                    const values = Object.values(row);
                    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

                    const query = `
                        INSERT INTO "${table}" (${keys}) 
                        VALUES (${placeholders})
                        ON CONFLICT DO NOTHING
                    `;

                    await supabasePool.query(query, values);
                }
                console.log(`  Completed ${table}.`);
            } catch (tableError) {
                console.error(`  Error migrating table ${table}:`, tableError);
            }
        }

        console.log('Migration finished successfully!');

    } catch (err) {
        console.error('Migration failed fatal:', err);
    } finally {
        await neonPool.end();
        await supabasePool.end();
    }
}

migrateData();
