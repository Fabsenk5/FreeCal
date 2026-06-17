import { db } from './backend/src/db';
import { pushSubscriptions } from './backend/src/db/schema';
import { eq, and } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

async function test() {
    try {
        console.log("Testing select...");
        const existingSub = await db.select().from(pushSubscriptions).limit(1);
        console.log("Select succeeded:", existingSub);

        // We can't insert a fake user ID because of the foreign key constraint unless we know a real user ID.
        // Let's get a real user ID.
        const { profiles } = require('./backend/src/db/schema');
        const user = await db.select().from(profiles).limit(1);
        if (user.length > 0) {
            console.log("Testing insert for user", user[0].id);
            await db.insert(pushSubscriptions).values({
                userId: user[0].id,
                endpoint: 'test',
                p256dh: 'test',
                auth: 'test'
            });
            console.log("Insert succeeded!");
        } else {
            console.log("No users found to test insert.");
        }
    } catch (e) {
        console.error("DB Error:", e);
    }
    process.exit(0);
}
test();
