/**
 * FreeCal API Layer — Supabase Edition
 *
 * This module provides all data access functions using the Supabase client.
 * It replaces the previous axios-based API that talked to an Express backend.
 *
 * All functions return data in the same shape as the old Express API
 * to minimize changes in consuming components.
 */
import { supabase } from './supabase';
import { prepareMoodBoardImage } from '../utils/imageCompression';

// Helper to format dates for notification titles
function formatDateForNotification(isoString: string): string {
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    } catch {
        return '';
    }
}

// ============================================================
// TYPE DEFINITIONS (unchanged from old api.ts)
// ============================================================

export interface User {
    id: string;
    email: string;
    display_name: string;
    avatar_url?: string;
    calendar_color: string;
}

export interface AuthResponse {
    user: User;
    token: string;
}

export interface Event {
    id: string;
    user_id: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    is_all_day: boolean;
    color: string;
    recurrence_rule: string | null;
    recurrence_type: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom';
    recurrence_days: string[] | null;
    recurrence_interval: number | null;
    recurrence_end_date: string | null;
    recurrence_exceptions: string[] | null;
    imported_from_device: boolean;
    location: string | null;
    url: string | null;
    is_tentative: boolean;
    alerts: Record<string, any>[] | null;
    travel_time: string | null;
    original_calendar_id: string | null;
    attendees: string[] | null;
    structured_metadata: Record<string, any> | null;
    created_at: string;
    updated_at: string;
}

export interface EventAttendeeDetail {
    /** Row id of event_attendees — populated by fetchEvents; absent in synthetic shapes (e.g. createEvent result). */
    id?: string;
    userId: string;
    /** Snake-case alias of userId — populated by fetchEvents for consumers that read raw column names. */
    user_id?: string;
    status: 'pending' | 'accepted' | 'declined';
}

export interface EventWithAttendees extends Event {
    attendees: any[];
    attendees_details?: EventAttendeeDetail[];
    viewers?: string[];
    creator_name?: string;
    creator_color?: string;
    isViewer?: boolean;
    isValentineEvent?: boolean;
    _originalEventId?: string;
}

export interface Profile {
    id: string;
    email: string;
    display_name: string;
    avatar_url?: string | null;
    calendar_color: string;
    is_approved: boolean;
    approval_status: 'pending' | 'approved' | 'rejected';
    approved_at?: string | null;
    approved_by?: string | null;
    created_at: string;
    updated_at: string;
    is_admin?: boolean;
    needs_password_reset?: boolean;
}

export interface Relationship {
    id: string;
    user_id: string;
    related_user_id: string;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
    updated_at: string;
}

export interface EventAttendee {
    id: string;
    event_id: string;
    user_id: string;
    is_attendee: boolean;
    status: 'pending' | 'accepted' | 'declined';
    created_at: string;
}

export interface EventViewer {
    id: string;
    event_id: string;
    user_id: string;
    created_at: string;
}

export interface TravelLocation {
    id: string;
    userId: string;
    name: string;
    latitude: string;
    longitude: string;
    country?: string | null;
    city?: string | null;
    visitedDate?: string | null;
    withRelationshipId?: string | null;
    isWishlist: boolean;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
    isOwn?: boolean;
    ownerName?: string;
    ownerColor?: string;
    withRelationshipName?: string | null;
}

// ============================================================
// HELPER: Throw on Supabase error
// ============================================================
function throwOnError<T>(result: { data: T | null; error: any }): T {
    if (result.error) {
        console.error('[Supabase Error]', result.error);
        throw new Error(result.error.message || 'Database error');
    }
    return result.data as T;
}

// ============================================================
// EVENTS API
// ============================================================

export interface FetchEventsOptions {
    rangeStart?: Date;
    rangeEnd?: Date;
}

export async function fetchEvents(userId: string, opts?: FetchEventsOptions): Promise<EventWithAttendees[]> {
    // RLS handles filtering — we just request all events we can see
    // We need to join attendees and viewers

    let query = supabase.from('events').select('*');

    // Optional server-side time-range filter (P4): keep events overlapping
    // [rangeStart, rangeEnd]. Recurring events are kept whenever they start
    // before the range end, because their concrete occurrences are expanded
    // client-side (src/utils/recurrence.ts) — a series can reach into the
    // range even when the master event's end_time lies before rangeStart.
    if (opts?.rangeStart && opts?.rangeEnd) {
        query = query
            .lte('start_time', opts.rangeEnd.toISOString())
            .or(`end_time.gte.${opts.rangeStart.toISOString()},recurrence_type.neq.none`);
    }

    const { data: eventsList, error } = await query;

    if (error) throw new Error(error.message);
    if (!eventsList || eventsList.length === 0) return [];

    const eventIds = eventsList.map(e => e.id);

    // Fetch attendees and viewers in parallel.
    // Explicit attendee column list guarantees the RSVP status is loaded (R19).
    const [attendeesResult, viewersResult] = await Promise.all([
        supabase.from('event_attendees').select('id, event_id, user_id, status').in('event_id', eventIds),
        supabase.from('event_viewers').select('*').in('event_id', eventIds),
    ]);

    const allAttendees = attendeesResult.data || [];
    const allViewers = viewersResult.data || [];

    // Collect all user IDs for profile lookup
    const userIdsSet = new Set<string>();
    eventsList.forEach(e => userIdsSet.add(e.user_id));
    allAttendees.forEach(a => userIdsSet.add(a.user_id));
    allViewers.forEach(v => userIdsSet.add(v.user_id));

    const uniqueUserIds = [...userIdsSet];
    const profilesResult = uniqueUserIds.length > 0
        ? await supabase.from('profiles').select('id, display_name, calendar_color').in('id', uniqueUserIds)
        : { data: [] };

    const profilesMap = new Map((profilesResult.data || []).map(p => [p.id, p]));

    // Group by event
    const attendeesByEvent = new Map<string, typeof allAttendees>();
    allAttendees.forEach(a => {
        if (!attendeesByEvent.has(a.event_id)) attendeesByEvent.set(a.event_id, []);
        attendeesByEvent.get(a.event_id)!.push(a);
    });

    const viewersByEvent = new Map<string, typeof allViewers>();
    allViewers.forEach(v => {
        if (!viewersByEvent.has(v.event_id)) viewersByEvent.set(v.event_id, []);
        viewersByEvent.get(v.event_id)!.push(v);
    });

    return eventsList.map(event => {
        const creator = profilesMap.get(event.user_id);
        const eventAttendees = attendeesByEvent.get(event.id) || [];
        const eventViewers = viewersByEvent.get(event.id) || [];
        const attendeeIds = eventAttendees.map(a => a.user_id);
        const viewerIds = eventViewers.map(v => v.user_id);

        const isCreator = event.user_id === userId;
        const isAttendee = attendeeIds.includes(userId);
        const isViewer = viewerIds.includes(userId) && !isCreator && !isAttendee;

        return {
            ...event,
            attendees: attendeeIds,
            attendees_details: eventAttendees.map(a => ({
                id: a.id,
                userId: a.user_id,
                user_id: a.user_id,
                status: a.status as 'pending' | 'accepted' | 'declined',
            })),
            viewers: viewerIds,
            creator_name: creator?.display_name,
            creator_color: creator?.calendar_color,
            isViewer,
        };
    });
}

export async function createEvent(userId: string, eventData: any): Promise<EventWithAttendees> {
    const attendees: string[] = eventData.attendees || [];
    const viewers: string[] = eventData.viewers || [];

    const { data: newEvent, error } = await supabase
        .from('events')
        .insert({
            user_id: userId,
            title: eventData.title,
            description: eventData.description,
            start_time: eventData.start_time,
            end_time: eventData.end_time,
            is_all_day: eventData.is_all_day,
            color: eventData.color,
            recurrence_rule: eventData.recurrence_rule,
            recurrence_type: eventData.recurrence_type,
            recurrence_days: eventData.recurrence_days,
            recurrence_interval: eventData.recurrence_interval,
            recurrence_end_date: eventData.recurrence_end_date,
            recurrence_exceptions: eventData.recurrence_exceptions || [],
            imported_from_device: eventData.imported_from_device,
            location: eventData.location,
            url: eventData.url,
            is_tentative: eventData.is_tentative,
            alerts: eventData.alerts,
            travel_time: eventData.travel_time,
            original_calendar_id: eventData.original_calendar_id,
            structured_metadata: eventData.structured_metadata,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);

    // Insert attendees
    if (attendees.length > 0) {
        const { error: attError } = await supabase.from('event_attendees').insert(
            attendees.map(aId => ({ event_id: newEvent.id, user_id: aId, status: 'pending' }))
        );
        if (attError) console.error('Error inserting attendees:', attError);
    }

    // Insert viewers
    if (viewers.length > 0) {
        const { error: viewError } = await supabase.from('event_viewers').insert(
            viewers.map(vId => ({ event_id: newEvent.id, user_id: vId }))
        );
        if (viewError) console.error('Error inserting viewers:', viewError);
    }

    // Send push notifications
    const allTargets = [...new Set([...attendees, ...viewers])];
    if (allTargets.length > 0) {
        const formattedDate = formatDateForNotification(newEvent.start_time);
        const dateStr = formattedDate ? ` (${formattedDate})` : '';
        api.post('/push/notify', {
            userIds: allTargets,
            title: `New Event: ${newEvent.title}${dateStr}`,
            body: `You have been added to a new event.`,
            url: `/?eventId=${newEvent.id}`
        }).catch(e => console.error('Push notify error:', e));
    }

    return {
        ...newEvent,
        attendees,
        attendees_details: attendees.map(id => ({ userId: id, user_id: id, status: 'pending' as const })),
        viewers,
    };
}

export interface ParticipantDiff {
    /** user_ids in desired but not in existing — must be inserted. */
    toInsert: string[];
    /** user_ids in existing but not in desired — must be deleted. */
    toDelete: string[];
    /** user_ids in both — left untouched so row state (RSVP status, flags) survives. */
    toKeep: string[];
}

/**
 * Pure diff between the currently stored participant user_ids and the
 * desired list. Exported for unit testing (src/lib/api.test.ts).
 */
export function computeParticipantDiff(existingUserIds: string[], desiredUserIds: string[]): ParticipantDiff {
    const existingSet = new Set(existingUserIds);
    const desiredSet = new Set(desiredUserIds);
    return {
        toInsert: [...desiredSet].filter(id => !existingSet.has(id)),
        toDelete: existingUserIds.filter(id => !desiredSet.has(id)),
        toKeep: existingUserIds.filter(id => desiredSet.has(id)),
    };
}

export async function updateEvent(eventId: string, userId: string, eventData: any): Promise<EventWithAttendees> {
    // Verify ownership via RLS (will fail if not owner)
    const { data: updatedEvent, error } = await supabase
        .from('events')
        .update({
            title: eventData.title,
            description: eventData.description,
            start_time: eventData.start_time,
            end_time: eventData.end_time,
            is_all_day: eventData.is_all_day,
            color: eventData.color,
            recurrence_rule: eventData.recurrence_rule,
            recurrence_type: eventData.recurrence_type,
            recurrence_days: eventData.recurrence_days,
            recurrence_interval: eventData.recurrence_interval,
            recurrence_end_date: eventData.recurrence_end_date,
            recurrence_exceptions: eventData.recurrence_exceptions !== undefined
                ? (eventData.recurrence_exceptions || [])
                : undefined,
            location: eventData.location,
            url: eventData.url,
            is_tentative: eventData.is_tentative,
        })
        .eq('id', eventId)
        .select()
        .single();

    if (error) throw new Error(error.message);

    const attendees: string[] | undefined = eventData.attendees;
    const viewers: string[] | undefined = eventData.viewers;

    // Diff-based participant update (R2): the previous
    // delete-all-then-reinsert approach reset every attendee's RSVP status
    // to the DB default ('pending') on each edit and, worse, left the event
    // without any participants if the insert failed after the delete. We now
    // load the current rows, delete only removed participants and insert only
    // newly added ones; kept rows stay untouched, so their status and
    // is_attendee/is_editor flags are preserved.
    // Note: still not transactional, but a failure can now only lose the new
    // inserts instead of the whole participant list.

    // Update attendees
    if (attendees !== undefined) {
        const { data: existingAttendees, error: readError } = await supabase
            .from('event_attendees')
            .select('user_id, status, is_attendee, is_editor')
            .eq('event_id', eventId);
        if (readError) throw new Error(readError.message);

        const diff = computeParticipantDiff((existingAttendees || []).map(a => a.user_id), attendees);

        if (diff.toDelete.length > 0) {
            const { error: deleteError } = await supabase
                .from('event_attendees')
                .delete()
                .eq('event_id', eventId)
                .in('user_id', diff.toDelete);
            if (deleteError) throw new Error(deleteError.message);
        }

        if (diff.toInsert.length > 0) {
            // Same row shape as before: status / is_attendee / is_editor
            // come from the DB defaults ('pending' / true / false).
            const { error: insertError } = await supabase.from('event_attendees').insert(
                diff.toInsert.map(aId => ({ event_id: eventId, user_id: aId }))
            );
            if (insertError) throw new Error(insertError.message);
        }
    }

    // Update viewers
    if (viewers !== undefined) {
        const { data: existingViewers, error: readError } = await supabase
            .from('event_viewers')
            .select('user_id')
            .eq('event_id', eventId);
        if (readError) throw new Error(readError.message);

        const diff = computeParticipantDiff((existingViewers || []).map(v => v.user_id), viewers);

        if (diff.toDelete.length > 0) {
            const { error: deleteError } = await supabase
                .from('event_viewers')
                .delete()
                .eq('event_id', eventId)
                .in('user_id', diff.toDelete);
            if (deleteError) throw new Error(deleteError.message);
        }

        if (diff.toInsert.length > 0) {
            const { error: insertError } = await supabase.from('event_viewers').insert(
                diff.toInsert.map(vId => ({ event_id: eventId, user_id: vId }))
            );
            if (insertError) throw new Error(insertError.message);
        }
    }

    // Send push notifications
    const allTargets = [...new Set([...(attendees || []), ...(viewers || [])])];
    if (allTargets.length > 0) {
        const formattedDate = formatDateForNotification(updatedEvent.start_time);
        const dateStr = formattedDate ? ` (${formattedDate})` : '';
        api.post('/push/notify', {
            userIds: allTargets,
            title: `Event Updated: ${updatedEvent.title}${dateStr}`,
            body: `An event you are part of has been updated.`,
            url: `/?eventId=${updatedEvent.id}`
        }).catch(e => console.error('Push notify error:', e));
    }

    return {
        ...updatedEvent,
        attendees: attendees || [],
        viewers: viewers || [],
    };
}

export async function deleteEvent(eventId: string): Promise<void> {
    // Fetch event details + participants before deleting
    const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

    let allTargets: string[] = [];
    if (event) {
        const [attendeesResult, viewersResult] = await Promise.all([
            supabase.from('event_attendees').select('user_id').eq('event_id', eventId),
            supabase.from('event_viewers').select('user_id').eq('event_id', eventId),
        ]);
        const attendeeIds = (attendeesResult.data || []).map(a => a.user_id);
        const viewerIds = (viewersResult.data || []).map(v => v.user_id);
        allTargets = [...new Set([...attendeeIds, ...viewerIds])];
    }

    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) throw new Error(error.message);

    // Send push notifications after successful delete
    if (event && allTargets.length > 0) {
        const formattedDate = formatDateForNotification(event.start_time);
        const dateStr = formattedDate ? ` (${formattedDate})` : '';
        api.post('/push/notify', {
            userIds: allTargets,
            title: `Event Cancelled: ${event.title}${dateStr}`,
            body: `An event you were part of has been cancelled.`,
            url: '/'
        }).catch(e => console.error('Push notify error:', e));
    }
}

export async function excludeOccurrence(eventId: string, excludedDate: string): Promise<string[]> {
    // R15: delegate to the atomic, duplicate-safe DB function
    // (supabase/security_hardening.sql). The old read-modify-write cycle
    // below loses updates when two exclusions race: both read the same
    // recurrence_exceptions array and the last write wins.
    const { data, error: rpcError } = await supabase.rpc('add_recurrence_exception', {
        p_event_id: eventId,
        p_date: excludedDate,
    });

    if (!rpcError) {
        // The function returns the resulting recurrence_exceptions array
        // (unchanged when the date was already excluded); NULL when the
        // event is not visible/writable for this user.
        return (data as string[] | null) ?? [];
    }

    // Fallback: the function may not be deployed yet — PostgREST reports
    // PGRST202 ("Could not find the function ... in the schema cache") or
    // PostgreSQL 42883 ("function ... does not exist"). Any other error is
    // a real failure and is rethrown.
    const isMissingFunction =
        rpcError.code === 'PGRST202' ||
        rpcError.code === '42883' ||
        /does not exist|could not find the function/i.test(rpcError.message || '');
    if (!isMissingFunction) throw new Error(rpcError.message);

    console.warn(
        '[excludeOccurrence] add_recurrence_exception RPC unavailable, falling back to read-modify-write:',
        rpcError.message
    );

    // Legacy read-modify-write (deployment fallback only, see R15 note above).
    const { data: existing, error: fetchError } = await supabase
        .from('events')
        .select('recurrence_exceptions')
        .eq('id', eventId)
        .single();

    if (fetchError) throw new Error(fetchError.message);

    const currentExceptions = existing.recurrence_exceptions || [];
    const updatedExceptions = [...currentExceptions, excludedDate];

    const { error } = await supabase
        .from('events')
        .update({ recurrence_exceptions: updatedExceptions })
        .eq('id', eventId);

    if (error) throw new Error(error.message);
    return updatedExceptions;
}

export async function respondToInvite(eventId: string, userId: string, status: 'accepted' | 'declined'): Promise<void> {
    const { error } = await supabase
        .from('event_attendees')
        .update({ status })
        .eq('event_id', eventId)
        .eq('user_id', userId);

    if (error) throw new Error(error.message);

    // Fetch event and responder profile to notify the event creator
    const [eventResult, profileResult] = await Promise.all([
        supabase.from('events').select('id, title, user_id, start_time').eq('id', eventId).single(),
        supabase.from('profiles').select('display_name').eq('id', userId).single(),
    ]);

    const event = eventResult.data;
    const responderProfile = profileResult.data;
    if (event && event.user_id !== userId) {
        const responderName = responderProfile?.display_name || 'Someone';
        const statusText = status === 'accepted' ? 'accepted' : 'declined';
        const formattedDate = formatDateForNotification(event.start_time);
        const dateStr = formattedDate ? ` (${formattedDate})` : '';
        api.post('/push/notify', {
            userIds: [event.user_id],
            title: `Invite ${statusText}: ${event.title}${dateStr}`,
            body: `${responderName} has ${statusText} your event invitation.`,
            url: `/?eventId=${event.id}`
        }).catch(e => console.error('Push notify error:', e));
    }
}

// ============================================================
// RELATIONSHIPS API
// ============================================================

export async function fetchRelationships(userId: string, status?: string): Promise<any[]> {
    let query = supabase.from('relationships').select('*');

    if (status) {
        query = query.eq('status', status);
    }

    // RLS filters to only relationships involving the user
    const { data: rels, error } = await query;
    if (error) throw new Error(error.message);
    if (!rels || rels.length === 0) return [];

    // Fetch profiles for the "other" user
    const otherUserIds = rels.map(r => r.user_id === userId ? r.related_user_id : r.user_id);
    const uniqueOtherIds = [...new Set(otherUserIds)];

    const { data: relatedProfiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', uniqueOtherIds);

    const profileMap = new Map((relatedProfiles || []).map(p => [p.id, p]));

    return rels.map(rel => {
        const otherId = rel.user_id === userId ? rel.related_user_id : rel.user_id;
        const profile = profileMap.get(otherId);
        return {
            ...rel,
            profile: profile ? {
                ...profile,
                // Already snake_case from Supabase
            } : null,
        };
    });
}

export async function createRelationship(userId: string, email: string): Promise<any> {
    // Find user by email
    const { data: targetUser, error: findError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', email)
        .single();

    if (findError || !targetUser) throw new Error('User not found');
    if (targetUser.id === userId) throw new Error('Cannot add yourself');

    // Check existing relationship
    const { data: existing } = await supabase
        .from('relationships')
        .select('id')
        .or(`and(user_id.eq.${userId},related_user_id.eq.${targetUser.id}),and(user_id.eq.${targetUser.id},related_user_id.eq.${userId})`);

    if (existing && existing.length > 0) throw new Error('Relationship already exists');

    const { data: newRel, error } = await supabase
        .from('relationships')
        .insert({ user_id: userId, related_user_id: targetUser.id, status: 'pending' })
        .select()
        .single();

    if (error) throw new Error(error.message);

    // Send push notification to the target user
    const { data: senderProfile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .single();

    const senderName = senderProfile?.display_name || 'Someone';
    api.post('/push/notify', {
        userIds: [targetUser.id],
        title: `New Connection Request`,
        body: `${senderName} wants to connect with you.`,
        url: '/?tab=profile'
    }).catch(e => console.error('Push notify error:', e));

    return newRel;
}

export async function updateRelationship(relationshipId: string, status: string): Promise<any> {
    // Fetch the relationship first to know who to notify
    const { data: existing } = await supabase
        .from('relationships')
        .select('*')
        .eq('id', relationshipId)
        .single();

    const { data, error } = await supabase
        .from('relationships')
        .update({ status })
        .eq('id', relationshipId)
        .select()
        .single();

    if (error) throw new Error(error.message);

    // Send push notification if accepted
    if (status === 'accepted' && existing) {
        const accepterId = data.related_user_id;
        const requesterId = data.user_id;

        const { data: accepterProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', accepterId)
            .single();

        const accepterName = accepterProfile?.display_name || 'Someone';
        api.post('/push/notify', {
            userIds: [requesterId],
            title: `Connection Accepted!`,
            body: `${accepterName} has accepted your connection request.`,
            url: '/?tab=profile'
        }).catch(e => console.error('Push notify error:', e));
    }

    return data;
}

export async function deleteRelationship(relationshipId: string): Promise<void> {
    const { error } = await supabase.from('relationships').delete().eq('id', relationshipId);
    if (error) throw new Error(error.message);
}

// ============================================================
// USER / PROFILE API
// ============================================================

export async function updateProfile(userId: string, updates: { display_name?: string; calendar_color?: string }): Promise<Profile> {
    const { data, error } = await supabase
        .from('profiles')
        .update({
            display_name: updates.display_name,
            calendar_color: updates.calendar_color,
        })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function searchUsers(email: string): Promise<Profile | null> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', email)
        .single();

    if (error) return null;
    return data;
}

// ============================================================
// ADMIN API
// ============================================================

export async function getAllUsers(): Promise<Profile[]> {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function adminUpdateUser(userId: string, updates: { approval_status?: string; is_approved?: boolean }): Promise<Profile> {
    const currentUser = await supabase.auth.getUser();
    const { data, error } = await supabase
        .from('profiles')
        .update({
            approval_status: updates.approval_status,
            is_approved: updates.is_approved,
            approved_at: updates.is_approved ? new Date().toISOString() : null,
            approved_by: updates.is_approved ? currentUser.data.user?.id : null,
        })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function adminDeleteUser(userId: string): Promise<void> {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) throw new Error(error.message);
}

// ============================================================
// FEATURE WISHLIST API
// ============================================================

export async function fetchFeatureWishes(): Promise<any[]> {
    const { data, error } = await supabase
        .from('feature_wishes')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function createFeatureWish(title: string, userId: string): Promise<any> {
    const { data, error } = await supabase
        .from('feature_wishes')
        .insert({ title, status: 'pending', created_by: userId })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function updateFeatureWishStatus(wishId: string, status: string): Promise<any> {
    const { data, error } = await supabase
        .from('feature_wishes')
        .update({ status })
        .eq('id', wishId)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteFeatureWish(wishId: string): Promise<void> {
    const { error } = await supabase.from('feature_wishes').delete().eq('id', wishId);
    if (error) throw new Error(error.message);
}

// ============================================================
// TRAVEL LOCATIONS API
// ============================================================

export async function fetchTravelLocations(userId: string): Promise<TravelLocation[]> {
    // RLS handles visibility (own + tagged)
    const { data: locations, error } = await supabase
        .from('travel_locations')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    if (!locations || locations.length === 0) return [];

    // Get profile info for enrichment
    const allUserIds = new Set<string>();
    locations.forEach(l => {
        allUserIds.add(l.user_id);
        if (l.with_relationship_id) allUserIds.add(l.with_relationship_id);
    });

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, calendar_color')
        .in('id', [...allUserIds]);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    return locations.map(loc => ({
        id: loc.id,
        userId: loc.user_id,
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
        country: loc.country,
        city: loc.city,
        visitedDate: loc.visited_date,
        withRelationshipId: loc.with_relationship_id,
        isWishlist: loc.is_wishlist,
        notes: loc.notes,
        createdAt: loc.created_at,
        updatedAt: loc.updated_at,
        isOwn: loc.user_id === userId,
        ownerName: profileMap.get(loc.user_id)?.display_name || 'Unknown',
        ownerColor: profileMap.get(loc.user_id)?.calendar_color || 'hsl(217, 91%, 60%)',
        withRelationshipName: loc.with_relationship_id
            ? profileMap.get(loc.with_relationship_id)?.display_name || null
            : null,
    }));
}

export async function createTravelLocation(userId: string, data: any): Promise<any> {
    const { data: newLoc, error } = await supabase
        .from('travel_locations')
        .insert({
            user_id: userId,
            name: data.name,
            latitude: String(data.latitude),
            longitude: String(data.longitude),
            country: data.country || null,
            city: data.city || null,
            visited_date: data.visitedDate || null,
            with_relationship_id: data.withRelationshipId || null,
            is_wishlist: data.isWishlist || false,
            notes: data.notes || null,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return newLoc;
}

export async function updateTravelLocation(locationId: string, data: any): Promise<any> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.latitude !== undefined) updateData.latitude = String(data.latitude);
    if (data.longitude !== undefined) updateData.longitude = String(data.longitude);
    if (data.country !== undefined) updateData.country = data.country;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.visitedDate !== undefined) updateData.visited_date = data.visitedDate || null;
    if (data.withRelationshipId !== undefined) updateData.with_relationship_id = data.withRelationshipId || null;
    if (data.isWishlist !== undefined) updateData.is_wishlist = data.isWishlist;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const { data: updated, error } = await supabase
        .from('travel_locations')
        .update(updateData)
        .eq('id', locationId)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return updated;
}

export async function deleteTravelLocation(locationId: string): Promise<void> {
    const { error } = await supabase.from('travel_locations').delete().eq('id', locationId);
    if (error) throw new Error(error.message);
}

// ============================================================
// MOOD BOARDS API
// ============================================================
// Mood/Story boards are shared Pinterest-style collections for shopping,
// interior and outfit ideas. Data access is Supabase-direct (RLS lives in
// supabase/moodboards.sql); images live in the private storage bucket
// 'board-images' and are served via short-lived signed URLs. Uploads are
// compressed to WebP on the client, see src/utils/imageCompression.ts.
// ============================================================

export const MOOD_BOARD_IMAGE_BUCKET = 'board-images';
export const MOOD_BOARD_SIGNED_URL_TTL_SECONDS = 2 * 60 * 60;

export type MoodBoardCategory = 'shopping' | 'interior' | 'outfit' | 'other';
export type MoodBoardRole = 'editor' | 'viewer';
export type MoodBoardVoteValue = -1 | 0 | 1;

export interface MoodBoardContact {
    id: string;
    display_name: string;
    avatar_url: string | null;
    calendar_color: string | null;
}

export interface MoodBoardMember {
    user_id: string;
    role: MoodBoardRole;
    display_name: string;
    avatar_url: string | null;
    calendar_color: string | null;
}

export interface MoodBoardPreviewImage {
    id: string;
    /** Signed preview URL (short-lived). */
    url: string;
}

export interface MoodBoardSummary {
    id: string;
    owner_id: string;
    title: string;
    description: string | null;
    category: MoodBoardCategory;
    created_at: string;
    updated_at: string;
    is_owner: boolean;
    my_role: 'owner' | MoodBoardRole;
    members: MoodBoardMember[];
    item_count: number;
    /** Up to 4 preview images for the overview tile mosaic. */
    preview_images: MoodBoardPreviewImage[];
}

export interface MoodBoardItem {
    id: string;
    board_id: string;
    user_id: string;
    note: string | null;
    link_url: string | null;
    price: number | null;
    created_at: string;
    updated_at: string;
    uploader_name: string;
    uploader_color: string | null;
    /** Signed full-size URL (short-lived). */
    image_url: string | null;
    /** Signed thumbnail URL (short-lived). */
    preview_url: string | null;
    up_votes: number;
    down_votes: number;
    my_vote: MoodBoardVoteValue;
    comments_count: number;
}

export interface MoodBoardDetail {
    board: MoodBoardSummary;
    items: MoodBoardItem[];
}

export interface MoodBoardComment {
    id: string;
    item_id: string;
    user_id: string;
    content: string;
    created_at: string;
    author_name: string;
    author_color: string | null;
}

export interface MoodBoardItemInput {
    note?: string | null;
    link_url?: string | null;
    price?: number | null;
}

export interface CreateMoodBoardInput {
    title: string;
    description?: string | null;
    category?: MoodBoardCategory;
}

// Raw row shapes as returned by Supabase (snake_case).
interface MoodBoardRow {
    id: string;
    owner_id: string;
    title: string;
    description: string | null;
    category: string;
    created_at: string;
    updated_at: string;
}

interface MoodBoardMemberRow {
    board_id: string;
    user_id: string;
    role: string;
}

interface MoodBoardPreviewItemRow {
    id: string;
    board_id: string;
    preview_path: string;
    created_at: string;
}

interface MoodBoardItemRow {
    id: string;
    board_id: string;
    user_id: string;
    image_path: string;
    preview_path: string;
    note: string | null;
    link_url: string | null;
    price: number | string | null;
    created_at: string;
    updated_at: string;
}

interface MoodBoardVoteRow {
    item_id: string;
    user_id: string;
    value: number;
}

interface SignedUrlEntry {
    path?: string | null;
    signedUrl?: string | null;
    signedURL?: string | null;
}

/** Batch-sign storage paths (chunked); unresolvable paths are skipped. */
async function createMoodBoardSignedUrlMap(
    paths: string[],
    expiresIn: number = MOOD_BOARD_SIGNED_URL_TTL_SECONDS,
): Promise<Map<string, string>> {
    const uniquePaths = [...new Set(paths.filter(Boolean))];
    const urlMap = new Map<string, string>();
    const chunkSize = 100;

    for (let i = 0; i < uniquePaths.length; i += chunkSize) {
        const chunk = uniquePaths.slice(i, i + chunkSize);
        const { data, error } = await supabase.storage
            .from(MOOD_BOARD_IMAGE_BUCKET)
            .createSignedUrls(chunk, expiresIn);

        if (error) {
            console.error('[MoodBoards] createSignedUrls failed:', error);
            continue;
        }

        ((data || []) as SignedUrlEntry[]).forEach(entry => {
            const url = entry.signedUrl || entry.signedURL;
            if (entry.path && url) urlMap.set(entry.path, url);
        });
    }

    return urlMap;
}

async function removeMoodBoardFiles(paths: (string | null | undefined)[]): Promise<void> {
    const uniquePaths = [...new Set(paths.filter((p): p is string => !!p))];
    const chunkSize = 100;

    for (let i = 0; i < uniquePaths.length; i += chunkSize) {
        const { error } = await supabase.storage
            .from(MOOD_BOARD_IMAGE_BUCKET)
            .remove(uniquePaths.slice(i, i + chunkSize));
        if (error) console.error('[MoodBoards] storage remove failed:', error);
    }
}

function normalizeMoodBoardLink(link?: string | null): string | null {
    const trimmed = link?.trim();
    if (!trimmed) return null;
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function buildMoodBoardSummary(
    board: MoodBoardRow,
    members: MoodBoardMemberRow[],
    profileMap: Map<string, MoodBoardContact>,
    itemCount: number,
    previewImages: MoodBoardPreviewImage[],
    userId: string,
): MoodBoardSummary {
    const myMembership = members.find(m => m.user_id === userId);
    return {
        id: board.id,
        owner_id: board.owner_id,
        title: board.title,
        description: board.description,
        category: board.category as MoodBoardCategory,
        created_at: board.created_at,
        updated_at: board.updated_at,
        is_owner: board.owner_id === userId,
        my_role: board.owner_id === userId
            ? 'owner'
            : ((myMembership?.role as MoodBoardRole) || 'viewer'),
        members: members.map(m => {
            const profile = profileMap.get(m.user_id);
            return {
                user_id: m.user_id,
                role: m.role as MoodBoardRole,
                display_name: profile?.display_name || 'Unknown',
                avatar_url: profile?.avatar_url ?? null,
                calendar_color: profile?.calendar_color ?? null,
            };
        }),
        item_count: itemCount,
        preview_images: previewImages,
    };
}

async function fetchMoodBoardProfileMap(userIds: string[]): Promise<Map<string, MoodBoardContact>> {
    const uniqueIds = [...new Set(userIds)];
    const profileMap = new Map<string, MoodBoardContact>();
    if (uniqueIds.length === 0) return profileMap;

    const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, calendar_color')
        .in('id', uniqueIds);
    if (error) throw new Error(error.message);

    (data || []).forEach((profile: MoodBoardContact) => {
        profileMap.set(profile.id, {
            id: profile.id,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url ?? null,
            calendar_color: profile.calendar_color ?? null,
        });
    });

    return profileMap;
}

/**
 * All boards the user owns or is a member of, newest activity first.
 * Each summary carries up to 4 signed preview images for the tile mosaic.
 */
export async function fetchMoodBoards(userId: string): Promise<MoodBoardSummary[]> {
    // RLS filters to boards the user owns or is a member of.
    const { data: boardRows, error: boardsError } = await supabase
        .from('mood_boards')
        .select('*')
        .order('updated_at', { ascending: false });

    if (boardsError) throw new Error(boardsError.message);
    const boards = (boardRows || []) as MoodBoardRow[];
    if (boards.length === 0) return [];

    const boardIds = boards.map(b => b.id);
    const [membersRes, itemsRes] = await Promise.all([
        supabase
            .from('mood_board_members')
            .select('board_id, user_id, role')
            .in('board_id', boardIds),
        supabase
            .from('mood_board_items')
            .select('id, board_id, preview_path, created_at')
            .in('board_id', boardIds)
            .order('created_at', { ascending: false }),
    ]);
    if (membersRes.error) throw new Error(membersRes.error.message);
    if (itemsRes.error) throw new Error(itemsRes.error.message);

    const members = (membersRes.data || []) as MoodBoardMemberRow[];
    const items = (itemsRes.data || []) as MoodBoardPreviewItemRow[];

    const profileMap = await fetchMoodBoardProfileMap(members.map(m => m.user_id));
    const signedUrls = await createMoodBoardSignedUrlMap(items.map(i => i.preview_path));

    const itemsByBoard = new Map<string, MoodBoardPreviewItemRow[]>();
    items.forEach(item => {
        const list = itemsByBoard.get(item.board_id) || [];
        list.push(item);
        itemsByBoard.set(item.board_id, list);
    });

    return boards.map(board => {
        const boardItems = itemsByBoard.get(board.id) || [];
        const boardMembers = members.filter(m => m.board_id === board.id);
        const previewImages: MoodBoardPreviewImage[] = boardItems
            .slice(0, 4)
            .map(item => ({ id: item.id, url: signedUrls.get(item.preview_path) || '' }))
            .filter(image => !!image.url);

        return buildMoodBoardSummary(
            board,
            boardMembers,
            profileMap,
            boardItems.length,
            previewImages,
            userId,
        );
    });
}

/** One board with all pins, vote/comment aggregates and signed image URLs. */
export async function fetchMoodBoard(boardId: string, userId: string): Promise<MoodBoardDetail> {
    const { data: boardRow, error: boardError } = await supabase
        .from('mood_boards')
        .select('*')
        .eq('id', boardId)
        .single();
    if (boardError) throw new Error(boardError.message);
    const board = boardRow as MoodBoardRow;

    const [membersRes, itemsRes] = await Promise.all([
        supabase
            .from('mood_board_members')
            .select('board_id, user_id, role')
            .eq('board_id', boardId),
        supabase
            .from('mood_board_items')
            .select('*')
            .eq('board_id', boardId)
            .order('created_at', { ascending: false }),
    ]);
    if (membersRes.error) throw new Error(membersRes.error.message);
    if (itemsRes.error) throw new Error(itemsRes.error.message);

    const members = (membersRes.data || []) as MoodBoardMemberRow[];
    const items = (itemsRes.data || []) as MoodBoardItemRow[];
    const itemIds = items.map(i => i.id);

    // Aggregates are computed client-side — boards are small. Revisit with a
    // SQL view if a single board ever grows into the thousands of pins.
    let votes: MoodBoardVoteRow[] = [];
    let commentRows: { item_id: string }[] = [];
    if (itemIds.length > 0) {
        const [votesRes, commentsRes] = await Promise.all([
            supabase
                .from('mood_board_votes')
                .select('item_id, user_id, value')
                .in('item_id', itemIds),
            supabase
                .from('mood_board_comments')
                .select('item_id')
                .in('item_id', itemIds),
        ]);
        if (votesRes.error) throw new Error(votesRes.error.message);
        if (commentsRes.error) throw new Error(commentsRes.error.message);
        votes = (votesRes.data || []) as MoodBoardVoteRow[];
        commentRows = (commentsRes.data || []) as { item_id: string }[];
    }

    const profileMap = await fetchMoodBoardProfileMap([
        ...members.map(m => m.user_id),
        ...items.map(i => i.user_id),
    ]);
    const signedUrls = await createMoodBoardSignedUrlMap([
        ...items.map(i => i.image_path),
        ...items.map(i => i.preview_path),
    ]);

    const itemList: MoodBoardItem[] = items.map(item => {
        const itemVotes = votes.filter(v => v.item_id === item.id);
        const myVoteRow = itemVotes.find(v => v.user_id === userId);
        const uploader = profileMap.get(item.user_id);
        return {
            id: item.id,
            board_id: item.board_id,
            user_id: item.user_id,
            note: item.note,
            link_url: item.link_url,
            price: item.price === null || item.price === undefined ? null : Number(item.price),
            created_at: item.created_at,
            updated_at: item.updated_at,
            uploader_name: uploader?.display_name || 'Unknown',
            uploader_color: uploader?.calendar_color ?? null,
            image_url: signedUrls.get(item.image_path) || null,
            preview_url: signedUrls.get(item.preview_path) || null,
            up_votes: itemVotes.filter(v => v.value === 1).length,
            down_votes: itemVotes.filter(v => v.value === -1).length,
            my_vote: myVoteRow ? (myVoteRow.value === 1 ? 1 : -1) : 0,
            comments_count: commentRows.filter(c => c.item_id === item.id).length,
        };
    });

    const previewImages: MoodBoardPreviewImage[] = itemList
        .slice(0, 4)
        .filter(item => !!item.preview_url)
        .map(item => ({ id: item.id, url: item.preview_url as string }));

    const summary = buildMoodBoardSummary(
        board,
        members.filter(m => m.board_id === boardId),
        profileMap,
        itemList.length,
        previewImages,
        userId,
    );

    return { board: summary, items: itemList };
}

export async function createMoodBoard(userId: string, input: CreateMoodBoardInput): Promise<MoodBoardSummary> {
    const title = input.title.trim();
    if (!title) throw new Error('Board title is required');

    const { data, error } = await supabase
        .from('mood_boards')
        .insert({
            owner_id: userId,
            title,
            description: input.description?.trim() || null,
            category: input.category || 'other',
        })
        .select()
        .single();
    if (error) throw new Error(error.message);

    return buildMoodBoardSummary(data as MoodBoardRow, [], new Map(), 0, [], userId);
}

export async function updateMoodBoard(
    boardId: string,
    updates: { title?: string; description?: string | null; category?: MoodBoardCategory },
): Promise<void> {
    const patch: Record<string, string | null> = {};
    if (updates.title !== undefined) {
        const title = updates.title.trim();
        if (!title) throw new Error('Board title is required');
        patch.title = title;
    }
    if (updates.description !== undefined) patch.description = updates.description?.trim() || null;
    if (updates.category !== undefined) patch.category = updates.category;
    if (Object.keys(patch).length === 0) return;

    const { error } = await supabase.from('mood_boards').update(patch).eq('id', boardId);
    if (error) throw new Error(error.message);
}

export async function deleteMoodBoard(boardId: string): Promise<void> {
    // Storage first (the owner may delete any object via the storage policy),
    // then the board row (cascades to members/items/comments/votes).
    const { data: items, error: itemsError } = await supabase
        .from('mood_board_items')
        .select('image_path, preview_path')
        .eq('board_id', boardId);
    if (itemsError) throw new Error(itemsError.message);

    await removeMoodBoardFiles(
        ((items || []) as { image_path: string; preview_path: string }[]).flatMap(item => [
            item.image_path,
            item.preview_path,
        ]),
    );

    const { error } = await supabase.from('mood_boards').delete().eq('id', boardId);
    if (error) throw new Error(error.message);
}

export async function addMoodBoardMember(
    boardId: string,
    userId: string,
    role: MoodBoardRole = 'editor',
): Promise<void> {
    const { error } = await supabase
        .from('mood_board_members')
        .upsert({ board_id: boardId, user_id: userId, role }, { onConflict: 'board_id,user_id' });
    if (error) throw new Error(error.message);
}

export async function updateMoodBoardMemberRole(
    boardId: string,
    userId: string,
    role: MoodBoardRole,
): Promise<void> {
    const { error } = await supabase
        .from('mood_board_members')
        .update({ role })
        .eq('board_id', boardId)
        .eq('user_id', userId);
    if (error) throw new Error(error.message);
}

export async function removeMoodBoardMember(boardId: string, userId: string): Promise<void> {
    const { error } = await supabase
        .from('mood_board_members')
        .delete()
        .eq('board_id', boardId)
        .eq('user_id', userId);
    if (error) throw new Error(error.message);
}

/**
 * Compress (WebP full + preview), upload both objects and insert the pin.
 * Returns the new pin id. On any failure nothing is left behind.
 */
export async function uploadMoodBoardItem(
    boardId: string,
    userId: string,
    file: File,
    input: MoodBoardItemInput = {},
): Promise<string> {
    const { full, preview } = await prepareMoodBoardImage(file);
    const itemId = crypto.randomUUID();
    const imagePath = `${boardId}/${userId}/${itemId}.webp`;
    const previewPath = `${boardId}/${userId}/${itemId}-thumb.webp`;

    const { error: fullError } = await supabase.storage
        .from(MOOD_BOARD_IMAGE_BUCKET)
        .upload(imagePath, full, { contentType: full.type || 'image/webp', upsert: false });
    if (fullError) throw new Error(`Upload failed: ${fullError.message}`);

    const { error: previewError } = await supabase.storage
        .from(MOOD_BOARD_IMAGE_BUCKET)
        .upload(previewPath, preview, { contentType: preview.type || 'image/webp', upsert: false });
    if (previewError) {
        await removeMoodBoardFiles([imagePath]);
        throw new Error(`Upload failed: ${previewError.message}`);
    }

    const { data, error } = await supabase
        .from('mood_board_items')
        .insert({
            id: itemId,
            board_id: boardId,
            user_id: userId,
            image_path: imagePath,
            preview_path: previewPath,
            note: input.note?.trim() || null,
            link_url: normalizeMoodBoardLink(input.link_url),
            price: input.price ?? null,
        })
        .select('id')
        .single();

    if (error) {
        await removeMoodBoardFiles([imagePath, previewPath]);
        throw new Error(error.message);
    }

    return (data as { id: string }).id;
}

export async function updateMoodBoardItem(itemId: string, updates: MoodBoardItemInput): Promise<void> {
    const patch: Record<string, string | number | null> = {};
    if (updates.note !== undefined) patch.note = updates.note?.trim() || null;
    if (updates.link_url !== undefined) patch.link_url = normalizeMoodBoardLink(updates.link_url);
    if (updates.price !== undefined) patch.price = updates.price ?? null;
    if (Object.keys(patch).length === 0) return;

    const { error } = await supabase.from('mood_board_items').update(patch).eq('id', itemId);
    if (error) throw new Error(error.message);
}

export async function deleteMoodBoardItem(itemId: string): Promise<void> {
    const { data: item, error: fetchError } = await supabase
        .from('mood_board_items')
        .select('image_path, preview_path')
        .eq('id', itemId)
        .single();
    if (fetchError) throw new Error(fetchError.message);

    const paths = item as { image_path: string; preview_path: string };
    await removeMoodBoardFiles([paths.image_path, paths.preview_path]);

    const { error } = await supabase.from('mood_board_items').delete().eq('id', itemId);
    if (error) throw new Error(error.message);
}

/**
 * Set the current user's vote on a pin. Tapping the active thumb again
 * removes the vote. Returns the resulting vote value (0 = removed).
 */
export async function setMoodBoardVote(
    itemId: string,
    userId: string,
    value: -1 | 1,
): Promise<MoodBoardVoteValue> {
    const { data: existing, error: fetchError } = await supabase
        .from('mood_board_votes')
        .select('value')
        .eq('item_id', itemId)
        .eq('user_id', userId)
        .maybeSingle();
    if (fetchError) throw new Error(fetchError.message);

    const existingValue = (existing as { value: number } | null)?.value;

    if (existingValue === value) {
        const { error } = await supabase
            .from('mood_board_votes')
            .delete()
            .eq('item_id', itemId)
            .eq('user_id', userId);
        if (error) throw new Error(error.message);
        return 0;
    }

    const { error } = await supabase
        .from('mood_board_votes')
        .upsert({ item_id: itemId, user_id: userId, value }, { onConflict: 'item_id,user_id' });
    if (error) throw new Error(error.message);
    return value;
}

export async function fetchMoodBoardComments(itemId: string): Promise<MoodBoardComment[]> {
    const { data, error } = await supabase
        .from('mood_board_comments')
        .select('id, item_id, user_id, content, created_at')
        .eq('item_id', itemId)
        .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return [];

    const comments = data as {
        id: string;
        item_id: string;
        user_id: string;
        content: string;
        created_at: string;
    }[];
    const profileMap = await fetchMoodBoardProfileMap(comments.map(c => c.user_id));

    return comments.map(comment => {
        const author = profileMap.get(comment.user_id);
        return {
            id: comment.id,
            item_id: comment.item_id,
            user_id: comment.user_id,
            content: comment.content,
            created_at: comment.created_at,
            author_name: author?.display_name || 'Unknown',
            author_color: author?.calendar_color ?? null,
        };
    });
}

export async function addMoodBoardComment(itemId: string, userId: string, content: string): Promise<void> {
    const trimmed = content.trim();
    if (!trimmed) throw new Error('Comment must not be empty');

    const { error } = await supabase
        .from('mood_board_comments')
        .insert({ item_id: itemId, user_id: userId, content: trimmed });
    if (error) throw new Error(error.message);
}

export async function deleteMoodBoardComment(commentId: string): Promise<void> {
    const { error } = await supabase.from('mood_board_comments').delete().eq('id', commentId);
    if (error) throw new Error(error.message);
}

/** Accepted contacts of the user, sorted by name — the share-dialog list. */
export async function fetchMoodBoardContacts(userId: string): Promise<MoodBoardContact[]> {
    const relationships = (await fetchRelationships(userId, 'accepted')) as {
        profile?: MoodBoardContact | null;
    }[];
    const seen = new Set<string>();
    const contacts: MoodBoardContact[] = [];

    relationships.forEach(rel => {
        const profile = rel.profile;
        if (!profile || profile.id === userId || seen.has(profile.id)) return;
        seen.add(profile.id);
        contacts.push({
            id: profile.id,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url ?? null,
            calendar_color: profile.calendar_color ?? null,
        });
    });

    return contacts.sort((a, b) => a.display_name.localeCompare(b.display_name));
}

/** Sign a single storage path on demand (e.g. before showing a full image). */
export async function getMoodBoardSignedUrl(
    path: string,
    expiresIn: number = MOOD_BOARD_SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
    const { data, error } = await supabase.storage
        .from(MOOD_BOARD_IMAGE_BUCKET)
        .createSignedUrl(path, expiresIn);
    if (error) {
        console.error('[MoodBoards] createSignedUrl failed:', error);
        return null;
    }
    return data?.signedUrl || null;
}

// ============================================================
// LEGACY BACKEND COMPATIBILITY: `api` object
// For endpoints that cannot be migrated to direct Supabase 
// calls (like Push Notifications which require private keys).
// ============================================================
// R14: warn once when the backend URL is missing instead of failing
// silently on every request (module-level flag so it fires only once).
let hasWarnedAboutMissingApiUrl = false;
const getApiUrl = () => {
    const url = import.meta.env.VITE_API_URL || '';
    if (!url && !hasWarnedAboutMissingApiUrl) {
        hasWarnedAboutMissingApiUrl = true;
        console.warn(
            '[api] Push notifications and comments require VITE_API_URL to be set. ' +
            'Add VITE_API_URL=<your backend URL> to .env.local and restart the dev server; ' +
            'until then, calls to the Express backend will fail.'
        );
    }
    return url;
};

const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
    };
};

export const api = {
    get: async (url: string) => {
        const res = await fetch(`${getApiUrl()}/api${url}`, { headers: await getHeaders() });
        if (!res.ok) throw new Error(`API error: ${res.statusText}`);
        return res.json();
    },
    post: async (url: string, data?: any) => {
        const res = await fetch(`${getApiUrl()}/api${url}`, { 
            method: 'POST',
            headers: await getHeaders(),
            body: data ? JSON.stringify(data) : undefined
        });
        if (!res.ok) {
            const errBody = await res.text().catch(() => '');
            console.error(`API Error on POST ${url}:`, errBody);
            throw new Error(`API error: ${res.statusText} - ${errBody}`);
        }
        return res.json();
    },
    put: async (url: string, data?: any) => {
        const res = await fetch(`${getApiUrl()}/api${url}`, { 
            method: 'PUT',
            headers: await getHeaders(),
            body: data ? JSON.stringify(data) : undefined
        });
        if (!res.ok) throw new Error(`API error: ${res.statusText}`);
        return res.json();
    },
    delete: async (url: string) => {
        const res = await fetch(`${getApiUrl()}/api${url}`, { 
            method: 'DELETE',
            headers: await getHeaders()
        });
        if (!res.ok) throw new Error(`API error: ${res.statusText}`);
        return res.json();
    },
};
