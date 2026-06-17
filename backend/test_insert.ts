import { db } from './src/db';
import { pushSubscriptions, profiles } from './src/db/schema';
import { eq, and } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
    try {
        console.log("Testing select...");
        const existingSub = await db.select().from(pushSubscriptions).limit(1);
        console.log("Select succeeded:", existingSub);

        const user = await db.select().from(profiles).limit(1);
        if (user.length > 0) {
            console.log("Testing insert for user", user[0].id);
            await db.insert(pushSubscriptions).values({
                userId: user[0].id,
                endpoint: 'test_endpoint_123',
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
