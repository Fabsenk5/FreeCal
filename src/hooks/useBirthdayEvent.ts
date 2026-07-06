import { useMemo } from 'react';
import { useBirthday, BIRTHDAY_MESSAGES } from '@/contexts/BirthdayContext';
import { EventWithAttendees } from '@/lib/api';

const BIRTHDAY_DATE_START = '2026-07-17';
const BIRTHDAY_DATE_SATURDAY = '2026-07-18';
const BIRTHDAY_DATE_SUNDAY = '2026-07-19';

/**
 * Hook to inject secret Birthday events into events list
 * Returns augmented events array with Birthday events for the weekend
 */
export function useBirthdayEvent(events: EventWithAttendees[]): EventWithAttendees[] {
    const { isBirthdayMode } = useBirthday();

    return useMemo(() => {
        if (!isBirthdayMode) {
            return events;
        }

        // Check if we already have the birthday events
        const hasEvent1 = events.some(e => e.title.includes(BIRTHDAY_MESSAGES.event1Title) || e.id === 'birthday-secret-event-1');
        const hasEvent2 = events.some(e => e.title.includes(BIRTHDAY_MESSAGES.event2Title) || e.id === 'birthday-secret-event-2');

        const injectedEvents: EventWithAttendees[] = [];

        if (!hasEvent1) {
            injectedEvents.push({
                id: 'birthday-secret-event-1',
                user_id: 'system',
                title: BIRTHDAY_MESSAGES.event1Title,
                description: BIRTHDAY_MESSAGES.event1Description,
                start_time: `${BIRTHDAY_DATE_START}T00:00:00`,
                end_time: `${BIRTHDAY_DATE_SATURDAY}T13:00:00`,
                is_all_day: false,
                color: 'hsl(320, 80%, 60%)', // distinct pink/purple for birthday
                recurrence_type: 'none',
                recurrence_rule: null,
                recurrence_days: null,
                recurrence_interval: null,
                recurrence_end_date: null,
                recurrence_exceptions: null,
                imported_from_device: false,
                location: 'Düsseldorf 🌆',
                url: null,
                is_tentative: false,
                alerts: null,
                travel_time: null,
                original_calendar_id: null,
                structured_metadata: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                attendees: [],
                viewers: [],
                attendees_details: [],
                creator_name: 'Dein Schatz',
                creator_color: 'hsl(320, 80%, 60%)',
                isViewer: false,
                isBirthdayEvent: true, // Special flag for styling
            } as EventWithAttendees & { isBirthdayEvent?: boolean });
        }

        if (!hasEvent2) {
            injectedEvents.push({
                id: 'birthday-secret-event-2',
                user_id: 'system',
                title: BIRTHDAY_MESSAGES.event2Title,
                description: BIRTHDAY_MESSAGES.event2Description,
                start_time: `${BIRTHDAY_DATE_SATURDAY}T13:00:00`,
                end_time: `${BIRTHDAY_DATE_SUNDAY}T18:00:00`,
                is_all_day: false,
                color: 'hsl(280, 80%, 60%)', // slightly different purple
                recurrence_type: 'none',
                recurrence_rule: null,
                recurrence_days: null,
                recurrence_interval: null,
                recurrence_end_date: null,
                recurrence_exceptions: null,
                imported_from_device: false,
                location: 'Düsseldorf 🌆',
                url: null,
                is_tentative: false,
                alerts: null,
                travel_time: null,
                original_calendar_id: null,
                structured_metadata: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                attendees: [],
                viewers: [],
                attendees_details: [],
                creator_name: 'Die Mädels',
                creator_color: 'hsl(280, 80%, 60%)',
                isViewer: false,
                isBirthdayEvent: true, // Special flag for styling
            } as EventWithAttendees & { isBirthdayEvent?: boolean });
        }

        if (injectedEvents.length === 0) {
            return events;
        }

        return [...events, ...injectedEvents];
    }, [events, isBirthdayMode]);
}
