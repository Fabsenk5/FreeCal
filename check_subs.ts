import { db } from './backend/src/db';
import { pushSubscriptions } from './backend/src/db/schema';
import * as dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

async function check() {
    try {
        const subs = await db.select().from(pushSubscriptions);
        console.log(`Total subscriptions: ${subs.length}`);
        console.log(subs);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
check();
