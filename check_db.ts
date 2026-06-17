import { db } from './backend/src/db';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

async function check() {
    try {
        const result = await db.execute(sql`SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'push_subscriptions'
        );`);
        console.log("Table exists:", result.rows[0].exists);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
