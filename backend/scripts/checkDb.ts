import { db } from '../src/db';
import { profiles } from '../src/db/schema';

async function main() {
    console.log('--- Checking Database For Users ---');
    try {
        const users = await db.select().from(profiles);
        console.log(`Found ${users.length} users.`);
        users.forEach(u => {
            console.log(`- ID: ${u.id}`);
            console.log(`  Email: '${u.email}'`);
            console.log(`  Has Password Hash: ${!!u.passwordHash}`);
            console.log(`  Approved: ${u.isApproved}`);
            console.log('---');
        });
    } catch (error) {
        console.error('Error querying database:', error);
    }
    process.exit(0);
}

main();
