/**
 * Full migration from Neon to Supabase — Data + Auth Users
 * 
 * This script:
 * 1. Reads all profile data from Neon
 * 2. Creates corresponding Supabase Auth users (with temp password)
 * 3. Updates profiles in Supabase (using the Auth user's UUID)
 * 4. Migrates all other tables, remapping old user IDs to new ones
 * 
 * Uses @supabase/supabase-js (REST API) for Supabase writes to avoid IPv6 issues.
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
    const required = ['NEON_DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
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

    // Map old profile IDs → new Supabase Auth UUIDs
    const idMap = new Map<string, string>();

    try {
        // Test connections
        console.log('Testing Neon connection...');
        await neonPool.query('SELECT 1');
        console.log('✅ Neon OK\n');

        // ─────────────────────────────────────────
        // Step 1: Read profiles from Neon
        // ─────────────────────────────────────────
        console.log('Step 1: Reading profiles from Neon...');
        const { rows: neonProfiles } = await neonPool.query('SELECT * FROM profiles');
        console.log(`  Found ${neonProfiles.length} profiles.\n`);

        // ─────────────────────────────────────────
        // Step 2: Create Supabase Auth users + profiles
        // ─────────────────────────────────────────
        console.log('Step 2: Creating Supabase Auth users & Profiles...');
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

                let newId = authUser?.user?.id;

                if (authError) {
                    if (authError.message?.includes('already been registered')) {
                        console.log(`  ⚠️  ${profile.email} already exists, looking up...`);
                        const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
                        const existing = users?.find(u => u.email === profile.email);
                        if (existing) {
                            newId = existing.id;
                            idMap.set(profile.id, newId);
                        } else {
                            continue;
                        }
                    } else {
                        throw authError;
                    }
                } else if (newId) {
                    idMap.set(profile.id, newId);
                    console.log(`  ✅ Auth: ${profile.email}`);
                }

                if (!newId) continue;

                // Update the auto-created profile with the original data
                const { error: profileErr } = await supabaseAdmin.from('profiles').update({
                    display_name: profile.display_name,
                    calendar_color: profile.calendar_color || 'hsl(217, 91%, 60%)',
                    avatar_url: profile.avatar_url,
                    is_approved: profile.is_approved ?? true,
                    approval_status: profile.approval_status || 'approved',
                    approved_at: profile.approved_at,
                    approved_by: profile.approved_by,
                    needs_password_reset: true,
                    updated_at: profile.updated_at || new Date().toISOString()
                }).eq('id', newId);

                if (profileErr) throw profileErr;

            } catch (err: any) {
                console.error(`  ❌ Error with ${profile.email}:`, err.message || err);
            }
        }

        console.log(`\nID mapping: ${idMap.size} users mapped.\n`);

        if (idMap.size === 0) {
            console.error('No users were mapped! Aborting data migration.');
            return;
        }

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
            if (!newUserId) continue;

            try {
                const { data: inserted, error } = await supabaseAdmin.from('events').insert({
                    user_id: newUserId,
                    title: event.title,
                    description: event.description,
                    location: event.location,
                    start_time: event.start_time,
                    end_time: event.end_time,
                    all_day: event.all_day,
                    color: event.color,
                    recurrence_rule: event.recurrence_rule,
                    recurrence_end_date: event.recurrence_end_date,
                    excluded_dates: event.excluded_dates,
                    created_at: event.created_at,
                    updated_at: event.updated_at
                }).select('id').single();

                if (error) {
                    if (error.code !== '23505') throw error; // ignore unique violation if any
                }
                if (inserted) {
                    eventIdMap.set(event.id, inserted.id);
                }
            } catch (err: any) {
                console.error(`  ❌ Event "${event.title}":`, err.message || err);
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
                const { error } = await supabaseAdmin.from('event_attendees').insert({
                    event_id: newEventId, user_id: newUserId, status: att.status, created_at: att.created_at
                });
                if (error && error.code !== '23505') throw error; // ignore unique violation
                attCount++;
            } catch (err: any) {
                console.error(`  ❌ Attendee:`, err.message || err);
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
                const { error } = await supabaseAdmin.from('event_viewers').insert({
                    event_id: newEventId, viewer_id: newUserId
                });
                if (error && error.code !== '23505') throw error;
                viewCount++;
            } catch (err: any) {
                console.error(`  ❌ Viewer:`, err.message || err);
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
                const { error } = await supabaseAdmin.from('relationships').insert({
                    user_id: newUserId, related_user_id: newRelatedId, status: rel.status, created_at: rel.created_at, updated_at: rel.updated_at
                });
                if (error && error.code !== '23505') throw error;
                relCount++;
            } catch (err: any) {
                console.error(`  ❌ Relationship:`, err.message || err);
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
                const { error } = await supabaseAdmin.from('feature_wishes').insert({
                    title: wish.title, status: wish.status, created_by: newUserId, created_at: wish.created_at
                });
                if (error && error.code !== '23505') throw error;
                wishCount++;
            } catch (err: any) {
                console.error(`  ❌ Wish:`, err.message || err);
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
                const { error } = await supabaseAdmin.from('travel_locations').insert({
                    user_id: newUserId, name: loc.name, latitude: loc.latitude, longitude: loc.longitude, country: loc.country, city: loc.city,
                    visited_date: loc.visited_date, with_relationship_id: newWithId, is_wishlist: loc.is_wishlist, notes: loc.notes, created_at: loc.created_at
                });
                if (error && error.code !== '23505') throw error;
                locCount++;
            } catch (err: any) {
                console.error(`  ❌ Location "${loc.name}":`, err.message || err);
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
    }
}

fullMigration();
