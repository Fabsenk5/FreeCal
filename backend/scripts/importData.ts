import { db } from '../src/db';
import { profiles, events, relationships, eventAttendees, eventViewers, featureWishes } from '../src/db/schema';
import * as fs from 'fs';
import * as path from 'path';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

// Helper to convert Python-style booleans and JSON arrays/objects from CSV
const processValue = (value: any) => {
    if (value === 'True') return true;
    if (value === 'False') return false;
    if (value === '') return null;

    // Try parsing JSON for arrays/objects (arrays like [] came as string in user example)
    if ((typeof value === 'string') && (value.startsWith('[') || value.startsWith('{'))) {
        try {
            // Replace single quotes with double quotes if necessary (standard JSON is double)
            // But CSV export might vary directly from source.
            // If it's valid JSON, this works.
            return JSON.parse(value);
        } catch (e) {
            // If simple JSON parse fails, return raw.
            return value;
        }
    }
    return value;
};

async function importData() {
    console.log('--- STARTING CSV MIGRATION SCRIPT (MERGE STRATEGY) ---');
    const dataDir = path.join(__dirname, '../migration-data');
    if (!fs.existsSync(dataDir)) {
        console.error('Migration data directory not found:', dataDir);
        process.exit(1);
    }

    const readCsv = (filename: string) => {
        const filePath = path.join(dataDir, filename);
        if (!fs.existsSync(filePath)) {
            console.log(`Skipping ${filename} (file not found)`);
            return [];
        }

        try {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            const records = parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                bom: true // Vital for Excel/Notepad saved CSVs
            });
            return records;
        } catch (e) {
            console.error(`Error parsing CSV ${filename}:`, e);
            return [];
        }
    };

    // Map CSV User IDs to Database User IDs (to handle merges)
    const idMapping = new Map<string, string>(); // csvId -> dbId

    // Helpter to get Mapped ID
    const getDbId = (csvId: string) => idMapping.get(csvId);

    // Track valid event IDs to filter orphans (attendees/viewers)
    const validEventIds = new Set<string>();

    // 1. Profiles
    try {
        const files = fs.readdirSync(dataDir);
        const profilesFile = files.find(f => f.startsWith('profiles') && f.endsWith('.csv'));

        if (profilesFile) {
            console.log(`Found profiles file: ${profilesFile}`);
            const profilesData = readCsv(profilesFile);
            console.log(`Processing ${profilesData.length} profiles...`);

            if (profilesData.length > 0) {
                // Fetch ALL existing users from DB to handle merges/conflicts
                const existingUsers = await db.select({ id: profiles.id, email: profiles.email }).from(profiles);
                const emailToIdMap = new Map<string, string>();
                existingUsers.forEach(u => {
                    if (u.email) emailToIdMap.set(u.email.toLowerCase(), u.id);
                });

                const profilesToInsert: any[] = [];

                for (const p of profilesData) {
                    const csvId = p.id;
                    const csvEmail = p.email ? p.email.toLowerCase() : null;

                    if (csvEmail && emailToIdMap.has(csvEmail)) {
                        // User exists! Map CSV ID to DB ID.
                        const dbId = emailToIdMap.get(csvEmail)!;
                        console.log(`Merging user ${csvEmail}: CSV ID ${csvId} -> Existing DB ID ${dbId}`);
                        idMapping.set(csvId, dbId);
                    } else {
                        // New user. Use CSV ID.
                        idMapping.set(csvId, csvId);
                        profilesToInsert.push({
                            id: csvId,
                            email: p.email,
                            displayName: p.display_name,
                            avatarUrl: p.avatar_url,
                            calendarColor: processValue(p.calendar_color),
                            isApproved: processValue(p.is_approved),
                            approvalStatus: p.approval_status,
                            approvedAt: p.approved_at ? new Date(p.approved_at) : null,
                            approvedBy: processValue(p.approved_by),
                            createdAt: p.created_at ? new Date(p.created_at) : new Date(),
                            updatedAt: p.updated_at ? new Date(p.updated_at) : new Date(),
                            passwordHash: null
                        });
                    }
                }

                if (profilesToInsert.length > 0) {
                    console.log(`Inserting ${profilesToInsert.length} new profiles...`);
                    await db.insert(profiles).values(profilesToInsert).onConflictDoNothing();
                } else {
                    console.log('No new profiles to insert (all merged).');
                }
            }
        } else {
            console.log('No profiles CSV found.');
        }
    } catch (e) {
        console.error('Error importing profiles:', e);
    }

    // 2. Events (Filtered by Valid Users & Remapped)
    try {
        const files = fs.readdirSync(dataDir);
        const eventsFile = files.find(f => f.startsWith('events') && f.endsWith('.csv') && !f.includes('attendees') && !f.includes('viewers'));
        if (eventsFile) {
            console.log(`Found events file: ${eventsFile}`);
            const eventsData = readCsv(eventsFile);

            const mappedEvents = [];
            for (const e of eventsData) {
                const dbUserId = getDbId(e.user_id);
                if (!dbUserId) {
                    // console.warn(`Skipping event ${e.id}: User ${e.user_id} not found/merged.`);
                    continue;
                }

                // We keep the Event ID from CSV unless it conflicts? 
                // Ideally we keep it to maintain relationships. 
                // If the event ID already exists, we skip (onConflictDoNothing).
                validEventIds.add(e.id);

                mappedEvents.push({
                    id: e.id,
                    userId: dbUserId, // Use REMAPPED User ID
                    title: e.title,
                    description: e.description,
                    startTime: new Date(e.start_time),
                    endTime: new Date(e.end_time),
                    isAllDay: processValue(e.is_all_day),
                    color: e.color,
                    recurrenceRule: e.recurrence_rule,
                    recurrenceType: e.recurrence_type || 'none',
                    recurrenceDays: processValue(e.recurrence_days),
                    recurrenceInterval: e.recurrence_interval ? parseInt(e.recurrence_interval) : null,
                    recurrenceEndDate: e.recurrence_end_date ? new Date(e.recurrence_end_date) : null,
                    importedFromDevice: processValue(e.imported_from_device),
                    location: e.location,
                    url: e.url,
                    isTentative: processValue(e.is_tentative),
                    alerts: processValue(e.alerts),
                    travelTime: e.travel_time,
                    originalCalendarId: processValue(e.original_calendar_id),
                    attendees: processValue(e.attendees),
                    structuredMetadata: processValue(e.structured_metadata),
                    createdAt: e.created_at ? new Date(e.created_at) : new Date(),
                    updatedAt: e.updated_at ? new Date(e.updated_at) : new Date(),
                });
            }

            console.log(`Importing ${mappedEvents.length} events...`);
            const chunkSize = 100;
            for (let i = 0; i < mappedEvents.length; i += chunkSize) {
                const chunk = mappedEvents.slice(i, i + chunkSize);
                await db.insert(events).values(chunk).onConflictDoNothing();
            }
        }
    } catch (e) {
        console.error('Error importing events:', e);
    }

    // 3. Relationships (Remapped)
    try {
        const files = fs.readdirSync(dataDir);
        const relsFile = files.find(f => f.startsWith('relationships') && f.endsWith('.csv'));
        if (relsFile) {
            console.log(`Found relationships file: ${relsFile}`);
            const relsData = readCsv(relsFile);

            const mappedRels = [];
            for (const r of relsData) {
                const u1 = getDbId(r.user_id);
                const u2 = getDbId(r.related_user_id);

                if (u1 && u2) {
                    mappedRels.push({
                        id: r.id,
                        userId: u1, // Remapped
                        relatedUserId: u2, // Remapped
                        status: r.status,
                        createdAt: r.created_at ? new Date(r.created_at) : new Date(),
                        updatedAt: r.updated_at ? new Date(r.updated_at) : new Date(),
                    });
                }
            }

            console.log(`Importing ${mappedRels.length} relationships...`);
            if (mappedRels.length > 0) {
                await db.insert(relationships).values(mappedRels).onConflictDoNothing();
            }
        }
    } catch (e) {
        console.error('Error importing relationships:', e);
    }

    // 4. Event Attendees (Remapped User ID + Valid Event ID)
    try {
        const files = fs.readdirSync(dataDir);
        const attendeesFile = files.find(f => f.startsWith('event_attendees') && f.endsWith('.csv'));
        if (attendeesFile) {
            console.log(`Found attendees file: ${attendeesFile}`);
            const attendeesData = readCsv(attendeesFile);

            const mappedAttendees = [];
            for (const a of attendeesData) {
                const uId = getDbId(a.user_id);
                const hasEvent = validEventIds.has(a.event_id);

                if (uId && hasEvent) {
                    mappedAttendees.push({
                        id: a.id,
                        eventId: a.event_id,
                        userId: uId, // Remapped
                        isAttendee: processValue(a.is_attendee),
                        createdAt: a.created_at ? new Date(a.created_at) : new Date(),
                    });
                }
            }

            console.log(`Importing ${mappedAttendees.length} attendees...`);
            const chunkSize = 100;
            for (let i = 0; i < mappedAttendees.length; i += chunkSize) {
                const chunk = mappedAttendees.slice(i, i + chunkSize);
                await db.insert(eventAttendees).values(chunk).onConflictDoNothing();
            }
        }
    } catch (e) {
        console.error('Error importing attendees:', e);
    }

    // 5. Event Viewers (Remapped User ID + Valid Event ID)
    try {
        const files = fs.readdirSync(dataDir);
        const viewersFile = files.find(f => f.startsWith('event_viewers') && f.endsWith('.csv'));
        if (viewersFile) {
            console.log(`Found viewers file: ${viewersFile}`);
            const viewersData = readCsv(viewersFile);

            const mappedViewers = [];
            for (const v of viewersData) {
                const uId = getDbId(v.user_id);
                const hasEvent = validEventIds.has(v.event_id);

                if (uId && hasEvent) {
                    mappedViewers.push({
                        id: v.id,
                        eventId: v.event_id,
                        userId: uId, // Remapped
                        createdAt: v.created_at ? new Date(v.created_at) : new Date(),
                    });
                }
            }

            console.log(`Importing ${mappedViewers.length} viewers...`);
            const chunkSize = 100;
            for (let i = 0; i < mappedViewers.length; i += chunkSize) {
                const chunk = mappedViewers.slice(i, i + chunkSize);
                await db.insert(eventViewers).values(chunk).onConflictDoNothing();
            }
        }
    } catch (e) {
        console.error('Error importing viewers:', e);
    }

    // 6. Feature Wishes
    try {
        const files = fs.readdirSync(dataDir);
        const wishesFile = files.find(f => f.startsWith('feature_wishes') && f.endsWith('.csv'));
        if (wishesFile) {
            console.log(`Found wishes file: ${wishesFile}`);
            const wishesData = readCsv(wishesFile);

            const mappedWishes = [];
            for (const w of wishesData) {
                // Determine createdBy user
                const creatorId = w.created_by ? getDbId(w.created_by) : null;

                mappedWishes.push({
                    id: w.id,
                    title: w.title,
                    status: w.status,
                    createdAt: w.created_at ? new Date(w.created_at) : new Date(),
                    createdBy: creatorId,
                });
            }

            console.log(`Importing ${mappedWishes.length} wishes...`);
            if (mappedWishes.length > 0) {
                await db.insert(featureWishes).values(mappedWishes).onConflictDoNothing();
            }
        }
    } catch (e) {
        console.error('Error importing wishes:', e);
    }

    console.log('Migration complete!');
    process.exit(0);
}

importData();
