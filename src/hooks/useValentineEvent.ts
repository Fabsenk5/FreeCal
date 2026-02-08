import { useMemo } from 'react';
import { useValentine, VALENTINE_MESSAGES } from '@/contexts/ValentineContext';
import { EventWithAttendees } from '@/lib/api';

// Valentine's Day 2026 - Feb 14th all day event
const VALENTINE_DATE = '2026-02-14';

/**
 * Hook to inject secret Valentine event into events list
 * Returns augmented events array with Valentine event on Feb 14th
 */
export function useValentineEvent(events: EventWithAttendees[]): EventWithAttendees[] {
    const { isValentineMode } = useValentine();

    return useMemo(() => {
        if (!isValentineMode) {
            return events;
        }

        // Check if we already have a valentine event (in case user created one manually)
        const hasValentineEvent = events.some(e =>
            e.title.includes('Valentine') ||
            e.title.includes('Valentinstag') ||
            e.title.includes('💕')
        );

        if (hasValentineEvent) {
            return events;
        }

        // Create secret Valentine event
        const valentineEvent: EventWithAttendees = {
            id: 'valentine-secret-2026',
            user_id: 'system',
            title: VALENTINE_MESSAGES.eventTitle,
            description: VALENTINE_MESSAGES.eventDescription,
            start_time: `${VALENTINE_DATE}T00:00:00`,
            end_time: `${VALENTINE_DATE}T23:59:59`,
            is_all_day: true,
            color: 'hsl(350, 80%, 60%)',
            recurrence_type: 'none',
            recurrence_rule: null,
            recurrence_days: null,
            recurrence_interval: null,
            recurrence_end_date: null,
            imported_from_device: false,
            location: 'In deinem Herzen 💖',
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
            creator_color: 'hsl(350, 80%, 60%)',
            isViewer: false,
            isValentineEvent: true, // Special flag for styling
        };

        return [...events, valentineEvent];
    }, [events, isValentineMode]);
}
