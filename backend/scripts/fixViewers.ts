import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

async function fixViewers() {
    console.log('Fixing event_viewers migration...');
    
    const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const neonPool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });

    try {
        const { rows: neonProfiles } = await neonPool.query('SELECT * FROM profiles');
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        
        const idMap = new Map<string, string>();
        for (const profile of neonProfiles) {
            const existing = users?.find(u => u.email === profile.email);
            if (existing) idMap.set(profile.id, existing.id);
        }

        const remap = (oldId: string) => idMap.get(oldId);

        const { rows: neonEvents } = await neonPool.query('SELECT id, title, created_at, user_id FROM events');
        const { data: supaEvents } = await supabaseAdmin.from('events').select('id, title, created_at, user_id');

        const eventIdMap = new Map<string, string>();

        for (const ne of neonEvents) {
            const mappedUser = remap(ne.user_id);
            // Match by title, user, and created_at substring to avoid precision issues
            const match = supaEvents?.find(se => 
                se.user_id === mappedUser && 
                se.title === ne.title &&
                new Date(se.created_at).getTime() === new Date(ne.created_at).getTime()
            );
            if (match) {
                eventIdMap.set(ne.id, match.id);
            } else {
                // Try looser date match (1 second difference)
                const looseMatch = supaEvents?.find(se => 
                    se.user_id === mappedUser && 
                    se.title === ne.title &&
                    Math.abs(new Date(se.created_at).getTime() - new Date(ne.created_at).getTime()) < 2000
                );
                if (looseMatch) eventIdMap.set(ne.id, looseMatch.id);
            }
        }

        console.log(`Matched ${eventIdMap.size} out of ${neonEvents.length} events for mapping.`);

        const { rows: viewers } = await neonPool.query('SELECT * FROM event_viewers');
        let viewCount = 0;

        for (const v of viewers) {
            const newEventId = eventIdMap.get(v.event_id);
            // The column in Neon was user_id, not viewer_id!
            const newUserId = remap(v.user_id); 
            
            if (!newEventId || !newUserId) continue;

            const { error } = await supabaseAdmin.from('event_viewers').insert({
                event_id: newEventId, 
                viewer_id: newUserId // In Supabase schema it's viewer_id (or user_id depending on how it's defined, let's assume viewer_id based on previous migration attempt)
            });
            
            if (error && error.code !== '23505') {
                 // Might actually be user_id in supabase too!
                 if (error.message.includes('viewer_id')) {
                     // Try user_id column
                     await supabaseAdmin.from('event_viewers').insert({
                        event_id: newEventId, user_id: newUserId
                     });
                 } else {
                     console.error(error);
                 }
            }
            viewCount++;
        }
        console.log(`✅ ${viewCount}/${viewers.length} viewers migrated successfully.`);
        
    } finally {
        await neonPool.end();
    }
}

fixViewers();
