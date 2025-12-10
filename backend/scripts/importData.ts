import { db } from '../src/db';
import { profiles, events, relationships, eventAttendees, eventViewers } from '../src/db/schema';
import * as fs from 'fs';
import * as path from 'path';

async function importData() {
    const dataDir = path.join(__dirname, '../migration-data');
    if (!fs.existsSync(dataDir)) {
        console.error('Migration data directory not found:', dataDir);
        process.exit(1);
    }

    console.log('Starting migration...');

    // 1. Profiles
    try {
        const profilesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'profiles.json'), 'utf-8'));
        console.log(`Importing ${profilesData.length} profiles...`);
        if (profilesData.length > 0) {
            // Need to handle missing passwordHash.
            // Also map keys if JSON is snake_case and schema is camelCase (Drizzle usually handles this if defined, but our schema has snake_case column names and camelCase keys in specific way?
            // Wait, Drizzle pgTable definitions have ('column_name').
            // The insert object keys should match the *variable names* in schema definition (camelCase), NOT the column names.
            // Exported JSON from Supabase will likely have snake_case keys (e.g. "display_name").
            // We need to map them.

            const mappedProfiles = profilesData.map((p: any) => ({
                id: p.id,
                email: p.email,
                displayName: p.display_name,
                avatarUrl: p.avatar_url,
                calendarColor: p.calendar_color,
                isApproved: p.is_approved,
                approvalStatus: p.approval_status,
                approvedAt: p.approved_at ? new Date(p.approved_at) : null,
                approvedBy: p.approved_by,
                createdAt: p.created_at ? new Date(p.created_at) : new Date(),
                updatedAt: p.updated_at ? new Date(p.updated_at) : new Date(),
                passwordHash: null // Users will need to reset password
            }));

            await db.insert(profiles).values(mappedProfiles).onConflictDoNothing();
        }
    } catch (e) {
        console.log('Skipping profiles (file not found or error):', e);
    }

    // 2. Events (Depends on Profiles)
    try {
        const eventsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'events.json'), 'utf-8'));
        console.log(`Importing ${eventsData.length} events...`);
        if (eventsData.length > 0) {
            const mappedEvents = eventsData.map((e: any) => ({
                id: e.id,
                userId: e.user_id,
                title: e.title,
                description: e.description,
                startTime: new Date(e.start_time),
                endTime: new Date(e.end_time),
                isAllDay: e.is_all_day,
                color: e.color,
                recurrenceRule: e.recurrence_rule,
                recurrenceType: e.recurrence_type,
                recurrenceDays: e.recurrence_days,
                recurrenceInterval: e.recurrence_interval,
                recurrenceEndDate: e.recurrence_end_date ? new Date(e.recurrence_end_date) : null,
                importedFromDevice: e.imported_from_device,
                location: e.location,
                url: e.url,
                isTentative: e.is_tentative,
                alerts: e.alerts,
                travelTime: e.travel_time,
                originalCalendarId: e.original_calendar_id,
                attendees: e.attendees,
                structuredMetadata: e.structured_metadata,
                createdAt: e.created_at ? new Date(e.created_at) : new Date(),
                updatedAt: e.updated_at ? new Date(e.updated_at) : new Date(),
            }));
            await db.insert(events).values(mappedEvents).onConflictDoNothing();
        }
    } catch (e) {
        console.log('Skipping events:', e);
    }

    // 3. Relationships
    try {
        const relsData = JSON.parse(fs.readFileSync(path.join(dataDir, 'relationships.json'), 'utf-8'));
        console.log(`Importing ${relsData.length} relationships...`);
        if (relsData.length > 0) {
            const mappedRels = relsData.map((r: any) => ({
                id: r.id,
                userId: r.user_id,
                relatedUserId: r.related_user_id,
                status: r.status,
                createdAt: r.created_at ? new Date(r.created_at) : new Date(),
                updatedAt: r.updated_at ? new Date(r.updated_at) : new Date(),
            }));
            await db.insert(relationships).values(mappedRels).onConflictDoNothing();
        }
    } catch (e) {
        console.log('Skipping relationships:', e);
    }

    // 4. Event Attendees
    try {
        const attendeesData = JSON.parse(fs.readFileSync(path.join(dataDir, 'event_attendees.json'), 'utf-8'));
        console.log(`Importing ${attendeesData.length} attendees...`);
        if (attendeesData.length > 0) {
            const mappedAttendees = attendeesData.map((a: any) => ({
                id: a.id,
                eventId: a.event_id,
                userId: a.user_id,
                isAttendee: a.is_attendee, // Might be undefined if not migrated yet in old DB
                createdAt: a.created_at ? new Date(a.created_at) : new Date(),
            }));
            await db.insert(eventAttendees).values(mappedAttendees).onConflictDoNothing();
        }
    } catch (e) {
        console.log('Skipping event attendees:', e);
    }

    // 5. Event Viewers
    try {
        const viewersData = JSON.parse(fs.readFileSync(path.join(dataDir, 'event_viewers.json'), 'utf-8'));
        console.log(`Importing ${viewersData.length} viewers...`);
        if (viewersData.length > 0) {
            const mappedViewers = viewersData.map((v: any) => ({
                id: v.id,
                eventId: v.event_id,
                userId: v.user_id,
                createdAt: v.created_at ? new Date(v.created_at) : new Date(),
            }));
            await db.insert(eventViewers).values(mappedViewers).onConflictDoNothing();
        }
    } catch (e) {
        console.log('Skipping event viewers:', e);
    }

    console.log('Migration complete!');
    process.exit(0);
}

importData();
