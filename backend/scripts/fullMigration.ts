/**
 * Full migration from Neon to Supabase — Data + Auth Users
 * 
 * This script:
 * 1. Reads all profile data from Neon
 * 2. Creates corresponding Supabase Auth users (with temp password)
 * 3. Inserts profiles into Supabase (using the Auth user's UUID)
 * 4. Migrates all other tables, remapping old user IDs to new ones
 * 
 * Requires in backend/.env:
 *   NEON_DATABASE_URL=...
 *   DATABASE_URL=... (Supabase)
 *   SUPABASE_URL=https://eokjccuvhxmguozbffgr.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=... (from Dashboard → Settings → API → service_role secret)
 * 
 * Usage: cd backend && npx -y tsx scripts/fullMigration.ts
 */
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

// Supabase Admin client for creating Auth users
import { createClient } from '@supabase/supabase-js';

const TEMP_PASSWORD = 'FreeCal2026!reset';

async function fullMigration() {
    console.log('=== FreeCal: Full Neon → Supabase Migration ===\n');

    // Validate env
    const required = ['NEON_DATABASE_URL', 'DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    for (const key of required) {
        if (!process.env[key]) {
            throw new Error(`Missing env var: ${key}`);
        }
    }

    const supabaseAdmin = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const neonPool = new Pool({
        connectionString: process.env.NEON_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    const supabasePool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    // Map old profile IDs → new Supabase Auth UUIDs
    const idMap = new Map<string, string>();

    try {
        // Test connections
        console.log('Testing Neon connection...');
        await neonPool.query('SELECT 1');
        console.log('✅ Neon OK\n');

        console.log('Testing Supabase connection...');
        await supabasePool.query('SELECT 1');
        console.log('✅ Supabase OK\n');

        // ─────────────────────────────────────────
        // Step 1: Read profiles from Neon
        // ─────────────────────────────────────────
        console.log('Step 1: Reading profiles from Neon...');
        const { rows: neonProfiles } = await neonPool.query('SELECT * FROM profiles');
        console.log(`  Found ${neonProfiles.length} profiles.\n`);

        // ─────────────────────────────────────────
        // Step 2: Create Supabase Auth users + profiles
        // ─────────────────────────────────────────
        console.log('Step 2: Creating Supabase Auth users...');
        for (const profile of neonProfiles) {
            try {
                // Create Auth user with temp password
                const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
                    email: profile.email,
                    password: TEMP_PASSWORD,
                    email_confirm: true, // auto-confirm email
                    user_metadata: {
                        display_name: profile.display_name,
                    }
                });

                if (authError) {
                    // User might already exist
                    if (authError.message?.includes('already been registered')) {
                        console.log(`  ⚠️  ${profile.email} already exists, looking up...`);
                        const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
                        const existing = users?.find(u => u.email === profile.email);
                        if (existing) {
                            idMap.set(profile.id, existing.id);
                            console.log(`  ↳ Mapped ${profile.id} → ${existing.id}`);
                        }
                        continue;
                    }
                    throw authError;
                }

                const newId = authUser.user.id;
                idMap.set(profile.id, newId);
                console.log(`  ✅ ${profile.email}: ${profile.id} → ${newId}`);

                // The trigger will auto-create a profile row, but we need to update it
                // with the original data (calendar_color, approval_status, etc.)
                await supabasePool.query(`
                    UPDATE profiles SET
                        display_name = $1,
                        calendar_color = $2,
                        avatar_url = $3,
                        is_approved = $4,
                        approval_status = $5,
                        approved_at = $6,
                        approved_by = $7,
                        needs_password_reset = true,
                        updated_at = $8
                    WHERE id = $9
                `, [
                    profile.display_name,
                    profile.calendar_color || 'hsl(217, 91%, 60%)',
                    profile.avatar_url,
                    profile.is_approved ?? true,
                    profile.approval_status || 'approved',
                    profile.approved_at,
                    profile.approved_by,
                    profile.updated_at || new Date().toISOString(),
                    newId
                ]);

            } catch (err) {
                console.error(`  ❌ Error with ${profile.email}:`, err);
            }
        }

        console.log(`\nID mapping: ${idMap.size} users mapped.\n`);

        if (idMap.size === 0) {
            console.error('No users were mapped! Aborting data migration.');
            return;
        }

        // Helper to remap a user ID column
        const remap = (oldId: string | null) => {
            if (!oldId) return null;
            return idMap.get(oldId) || oldId;
        };

        // ─────────────────────────────────────────
        // Step 3: Migrate events
        // ─────────────────────────────────────────
        console.log('Step 3: Migrating events...');
        const { rows: events } = await neonPool.query('SELECT * FROM events');
        let eventIdMap = new Map<string, string>();

        for (const event of events) {
            const newUserId = remap(event.user_id);
            if (!newUserId) {
                console.log(`  ⚠️  Skipping event "${event.title}" — user not mapped`);
                continue;
            }

            try {
                const { rows: [inserted] } = await supabasePool.query(`
                    INSERT INTO events (user_id, title, description, location, start_time, end_time, 
                        all_day, color, recurrence_rule, recurrence_end_date, excluded_dates, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    ON CONFLICT DO NOTHING
                    RETURNING id
                `, [
                    newUserId, event.title, event.description, event.location,
                    event.start_time, event.end_time, event.all_day, event.color,
                    event.recurrence_rule, event.recurrence_end_date, event.excluded_dates,
                    event.created_at, event.updated_at
                ]);

                if (inserted) {
                    eventIdMap.set(event.id, inserted.id);
                }
            } catch (err) {
                console.error(`  ❌ Event "${event.title}":`, err);
            }
        }
        console.log(`  ✅ ${eventIdMap.size}/${events.length} events migrated.\n`);

        // ─────────────────────────────────────────
        // Step 4: Migrate event_attendees
        // ─────────────────────────────────────────
        console.log('Step 4: Migrating event_attendees...');
        const { rows: attendees } = await neonPool.query('SELECT * FROM event_attendees');
        let attCount = 0;

        for (const att of attendees) {
            const newEventId = eventIdMap.get(att.event_id);
            const newUserId = remap(att.user_id);
            if (!newEventId || !newUserId) continue;

            try {
                await supabasePool.query(`
                    INSERT INTO event_attendees (event_id, user_id, status, created_at)
                    VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING
                `, [newEventId, newUserId, att.status, att.created_at]);
                attCount++;
            } catch (err) {
                console.error(`  ❌ Attendee:`, err);
            }
        }
        console.log(`  ✅ ${attCount}/${attendees.length} attendees migrated.\n`);

        // ─────────────────────────────────────────
        // Step 5: Migrate event_viewers
        // ─────────────────────────────────────────
        console.log('Step 5: Migrating event_viewers...');
        const { rows: viewers } = await neonPool.query('SELECT * FROM event_viewers');
        let viewCount = 0;

        for (const v of viewers) {
            const newEventId = eventIdMap.get(v.event_id);
            const newUserId = remap(v.viewer_id);
            if (!newEventId || !newUserId) continue;

            try {
                await supabasePool.query(`
                    INSERT INTO event_viewers (event_id, viewer_id) 
                    VALUES ($1, $2) ON CONFLICT DO NOTHING
                `, [newEventId, newUserId]);
                viewCount++;
            } catch (err) {
                console.error(`  ❌ Viewer:`, err);
            }
        }
        console.log(`  ✅ ${viewCount}/${viewers.length} viewers migrated.\n`);

        // ─────────────────────────────────────────
        // Step 6: Migrate relationships
        // ─────────────────────────────────────────
        console.log('Step 6: Migrating relationships...');
        const { rows: rels } = await neonPool.query('SELECT * FROM relationships');
        let relCount = 0;

        for (const rel of rels) {
            const newUserId = remap(rel.user_id);
            const newRelatedId = remap(rel.related_user_id);
            if (!newUserId || !newRelatedId) continue;

            try {
                await supabasePool.query(`
                    INSERT INTO relationships (user_id, related_user_id, status, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING
                `, [newUserId, newRelatedId, rel.status, rel.created_at, rel.updated_at]);
                relCount++;
            } catch (err) {
                console.error(`  ❌ Relationship:`, err);
            }
        }
        console.log(`  ✅ ${relCount}/${rels.length} relationships migrated.\n`);

        // ─────────────────────────────────────────
        // Step 7: Migrate feature_wishes
        // ─────────────────────────────────────────
        console.log('Step 7: Migrating feature_wishes...');
        const { rows: wishes } = await neonPool.query('SELECT * FROM feature_wishes');
        let wishCount = 0;

        for (const wish of wishes) {
            const newUserId = remap(wish.created_by);
            try {
                await supabasePool.query(`
                    INSERT INTO feature_wishes (title, status, created_by, created_at)
                    VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING
                `, [wish.title, wish.status, newUserId, wish.created_at]);
                wishCount++;
            } catch (err) {
                console.error(`  ❌ Wish:`, err);
            }
        }
        console.log(`  ✅ ${wishCount}/${wishes.length} wishes migrated.\n`);

        // ─────────────────────────────────────────
        // Step 8: Migrate travel_locations
        // ─────────────────────────────────────────
        console.log('Step 8: Migrating travel_locations...');
        const { rows: locations } = await neonPool.query('SELECT * FROM travel_locations');
        let locCount = 0;

        for (const loc of locations) {
            const newUserId = remap(loc.user_id);
            const newWithId = remap(loc.with_relationship_id);
            if (!newUserId) continue;

            try {
                await supabasePool.query(`
                    INSERT INTO travel_locations (user_id, name, latitude, longitude, country, city,
                        visited_date, with_relationship_id, is_wishlist, notes, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING
                `, [
                    newUserId, loc.name, loc.latitude, loc.longitude, loc.country, loc.city,
                    loc.visited_date, newWithId, loc.is_wishlist, loc.notes, loc.created_at
                ]);
                locCount++;
            } catch (err) {
                console.error(`  ❌ Location "${loc.name}":`, err);
            }
        }
        console.log(`  ✅ ${locCount}/${locations.length} locations migrated.\n`);

        // ─────────────────────────────────────────
        // Summary
        // ─────────────────────────────────────────
        console.log('=== Migration Summary ===');
        console.log(`Users:        ${idMap.size}/${neonProfiles.length}`);
        console.log(`Events:       ${eventIdMap.size}/${events.length}`);
        console.log(`Attendees:    ${attCount}/${attendees.length}`);
        console.log(`Viewers:      ${viewCount}/${viewers.length}`);
        console.log(`Relationships:${relCount}/${rels.length}`);
        console.log(`Wishes:       ${wishCount}/${wishes.length}`);
        console.log(`Locations:    ${locCount}/${locations.length}`);
        console.log(`\n⚠️  Temporary password for ALL users: "${TEMP_PASSWORD}"`);
        console.log('   Users should change their password via admin or "Forgot Password".\n');

    } catch (err) {
        console.error('\n❌ Migration failed:', err);
    } finally {
        await neonPool.end();
        await supabasePool.end();
    }
}

fullMigration();
