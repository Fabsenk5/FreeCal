import type { EventWithAttendees } from '@/lib/api';

/**
 * Domain rule: an event blocks a user's free time only when the user owns the
 * event or is an *accepted* attendee. Pending/declined attendees never block,
 * and viewers never block.
 *
 * Attendee entries come in two shapes depending on the data source:
 * - plain string ids (no status info): the status is looked up in
 *   `attendees_details`; if that is missing too, the entry is treated as
 *   'accepted' so no busy time is silently lost.
 * - objects (`user_id`/`id` + optional `status`): a missing `status` is
 *   treated as 'accepted'.
 */
export function eventBlocksUser(event: EventWithAttendees, userId: string): boolean {
    // The owner always blocks.
    if (event.user_id === userId) return true;

    const attendees = event.attendees || [];
    return attendees.some((att: unknown) => {
        if (typeof att === 'string') {
            if (att !== userId) return false;
            const detail = event.attendees_details?.find((d) => d.userId === userId);
            return (detail?.status ?? 'accepted') === 'accepted';
        }
        const entry = att as { user_id?: string; id?: string; status?: string } | null;
        const attendeeId = entry?.user_id ?? entry?.id;
        if (attendeeId !== userId) return false;
        return (entry?.status ?? 'accepted') === 'accepted';
    });
}

/**
 * True for injected special events (birthday/valentine). They are not stored
 * per user (`user_id` is 'system') but belong to the viewing user's calendar,
 * so they block that user's time in the Free Time Finder.
 */
export function isSpecialEvent(event: EventWithAttendees): boolean {
    const e = event as EventWithAttendees & { isBirthdayEvent?: boolean; isValentineEvent?: boolean };
    return e.user_id === 'system' || !!e.isBirthdayEvent || !!e.isValentineEvent;
}
