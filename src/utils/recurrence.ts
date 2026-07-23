import { RRule, RRuleSet, rrulestr } from 'rrule';
import type { Options, Weekday } from 'rrule';
import { EventWithAttendees } from '@/lib/api';

/**
 * Reinterprets the local wall-clock components of `date` as a UTC timestamp
 * ("floating" time). rrule always iterates over the UTC components of its
 * dates, so feeding it floating dates makes it expand in local wall-clock
 * time: a 10:00 local event stays 10:00 local on every occurrence, even
 * across DST transitions.
 */
function toFloatingUTC(date: Date): Date {
    return new Date(Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
        date.getMilliseconds()
    ));
}

/**
 * Inverse of {@link toFloatingUTC}: reads the UTC components of a floating
 * occurrence as local wall-clock components, yielding the real local Date
 * the user should see for that occurrence.
 */
function fromFloatingUTC(date: Date): Date {
    return new Date(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
        date.getUTCMilliseconds()
    );
}

/**
 * Expands recurring events within a given date range.
 *
 * Expansion happens in local wall-clock time (see {@link toFloatingUTC}):
 * occurrences keep the local time of day of the event start across DST
 * boundaries, instead of drifting by the DST offset.
 *
 * @param events List of events (some may be recurring)
 * @param startRange Start of the view range
 * @param endRange End of the view range
 * @returns Expanded list of events where recurring events are duplicated for each occurrence
 */
export function expandRecurringEvents(
    events: EventWithAttendees[],
    startRange: Date,
    endRange: Date
): EventWithAttendees[] {
    const expandedEvents: EventWithAttendees[] = [];

    events.forEach((event) => {
        // If not recurring, just add it
        if (!event.recurrence_type || event.recurrence_type === 'none') {
            expandedEvents.push(event);
            return;
        }

        try {
            const eventStart = new Date(event.start_time);
            const eventEnd = new Date(event.end_time);

            if (isNaN(eventStart.getTime()) || isNaN(eventEnd.getTime())) {
                expandedEvents.push(event);
                return;
            }
            const duration = eventEnd.getTime() - eventStart.getTime();

            // Determine Frequency
            let freq = RRule.WEEKLY;
            switch (event.recurrence_type) {
                case 'daily': freq = RRule.DAILY; break;
                case 'weekly': freq = RRule.WEEKLY; break;
                case 'monthly': freq = RRule.MONTHLY; break;
                case 'custom': freq = RRule.WEEKLY; break; // Default custom to weekly for now if not specified
            }

            // Determine Interval
            let interval = 1;
            if (event.recurrence_interval) {
                const parsed = parseInt(String(event.recurrence_interval), 10);
                if (!isNaN(parsed) && parsed > 0) {
                    interval = parsed;
                }
            }

            // Determine Days (for weekly)
            // Map '0'...'6' or 'SU'...'SA'
            let byweekday: Weekday[] | null = null;
            if (Array.isArray(event.recurrence_days) && event.recurrence_days.length > 0) {
                byweekday = event.recurrence_days.map(d => {
                    const day = parseInt(String(d), 10);
                    switch (day) {
                        case 0: return RRule.SU;
                        case 1: return RRule.MO;
                        case 2: return RRule.TU;
                        case 3: return RRule.WE;
                        case 4: return RRule.TH;
                        case 5: return RRule.FR;
                        case 6: return RRule.SA;
                        default: return null;
                    }
                }).filter((d): d is Weekday => d !== null);
            }


            // Create RRule. All dates handed to rrule are converted to
            // floating UTC so the expansion happens in local wall-clock
            // time (see toFloatingUTC) and does not drift across DST changes.
            const ruleOptions: Partial<Options> = {
                freq,
                interval,
                dtstart: toFloatingUTC(eventStart), // Occurrences start from event start
                until: event.recurrence_end_date ? toFloatingUTC(new Date(event.recurrence_end_date)) : undefined,
            };

            if (byweekday && byweekday.length > 0) {
                ruleOptions.byweekday = byweekday;
            }

            const rule = new RRule(ruleOptions);

            // Get all occurrences between range (range converted to the same
            // floating wall-clock space; `between` compares plain timestamps).
            const occurrences = rule.between(toFloatingUTC(startRange), toFloatingUTC(endRange), true);

            // Translate occurrences back to real local dates.
            const localOccurrences = occurrences.map(fromFloatingUTC);

            // Filter out excluded occurrences (recurrence_exceptions).
            // Exceptions are stored as ISO timestamps of an occurrence's
            // start_time (see excludeOccurrence in api.ts); comparing local
            // calendar days on both sides matches what the user sees.
            const exceptions = new Set(
                (event.recurrence_exceptions || []).map(d => new Date(d).toDateString())
            );
            const filteredOccurrences = localOccurrences.filter(
                date => !exceptions.has(date.toDateString())
            );

            // Map occurrences to new event objects
            filteredOccurrences.forEach(date => {
                const occStart = new Date(date);
                const occEnd = new Date(date.getTime() + duration);

                expandedEvents.push({
                    ...event,
                    id: `${event.id}_${date.getTime()}`, // Unique ID for key prop
                    _originalEventId: event.id, // Preserve original DB ID for update/delete
                    start_time: occStart.toISOString(),
                    end_time: occEnd.toISOString(),
                });
            });

        } catch (e) {
            console.error('Error expanding recurrence for event', event.id, e);
            // Fallback: just show original
            expandedEvents.push(event);
        }
    });

    return expandedEvents;
}
