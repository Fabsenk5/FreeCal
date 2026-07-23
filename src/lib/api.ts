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
