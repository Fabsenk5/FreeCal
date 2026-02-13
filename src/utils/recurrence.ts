import { RRule, RRuleSet, rrulestr } from 'rrule';
import { EventWithAttendees } from '@/lib/api';

/**
 * Expands recurring events within a given date range.
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
            let byweekday: any[] | null = null;
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
                }).filter(d => d !== null);
            }


            // Create RRule
            const ruleOptions: any = {
                freq,
                interval,
                dtstart: eventStart, // Occurrences start from event start
                until: event.recurrence_end_date ? new Date(event.recurrence_end_date) : undefined,
            };

            if (byweekday && byweekday.length > 0) {
                ruleOptions.byweekday = byweekday;
            }

            const rule = new RRule(ruleOptions);

            // Get all occurrences between range
            // We pad the range slightly to ensuring we catch edge cases
            const occurrences = rule.between(startRange, endRange, true);

            // Map occurrences to new event objects
            occurrences.forEach(date => {
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
