
import { db } from '../src/db';
import { profiles, events } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function checkData() {
    console.log('Checking for user: fabiank5@hotmail.com');

    // 1. Get User
    const user = await db.select().from(profiles).where(eq(profiles.email, 'fabiank5@hotmail.com')).limit(1);

    if (user.length === 0) {
        console.error('User not found in DB!');
        process.exit(1);
    }

    const userId = user[0].id;
    console.log(`User Found: ${user[0].displayName} (ID: ${userId})`);

    // 2. Get Events
    const userEvents = await db.select().from(events).where(eq(events.userId, userId));
    console.log(`Found ${userEvents.length} events for this user.`);

    if (userEvents.length > 0) {
        console.log('First 5 events:');
        userEvents.slice(0, 5).forEach(e => {
            console.log(`- [${e.startTime.toISOString()}] ${e.title}`);
        });
    }

    process.exit(0);
}

checkData();
