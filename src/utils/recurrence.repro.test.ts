import { expandRecurringEvents } from './recurrence';
import { describe, it, expect } from 'vitest';
import { EventWithAttendees } from '@/lib/api';

describe('expandRecurringEvents Reproduction', () => {
    it('should expand a weekly event on Friday (Feb 13 2026 -> Feb 20 2026)', () => {
        // User scenario:
        // Start Date: 13.02.2026 (Friday)
        // Recurrence: Weekly
        // Repeat on: Friday (Index 5)

        // Mock Event
        const startIso = '2026-02-13T10:30:00.000Z'; // Assuming UTC for test consistency
        const endIso = '2026-02-13T11:30:00.000Z';

        const baseEvent: EventWithAttendees = {
            id: 'repro-1',
            title: 'Test Recurring Fridays',
            start_time: startIso,
            end_time: endIso,
            recurrence_type: 'weekly',
            recurrence_days: ['5'], // Friday
            recurrence_interval: 1,
            recurrence_end_date: null,
            user_id: 'u1',
            is_all_day: false,
            color: 'blue',
            attendees: [],
            viewers: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            description: null,
            imported_from_device: false,
            location: null,
            url: null,
            is_tentative: false,
            alerts: null,
            travel_time: null,
            original_calendar_id: null,
            attendees_details: [],
            isViewer: false
        };

        // View Range: Feb 2026
        // Month view often requests previous/next month padding
        const startRange = new Date('2026-02-01T00:00:00Z');
        const endRange = new Date('2026-02-28T23:59:59Z');

        console.log('--- Debugging Expansion ---');
        const expanded = expandRecurringEvents([baseEvent], startRange, endRange);

        // Debug output
        expanded.forEach(e => {
            console.log(`Expanded: ${e.start_time}`);
        });

        // specific checks
        const feb13 = expanded.find(e => e.start_time.startsWith('2026-02-13'));
        const feb20 = expanded.find(e => e.start_time.startsWith('2026-02-20'));

        expect(feb13).toBeDefined();
        expect(feb20).toBeDefined();
        expect(expanded.length).toBeGreaterThanOrEqual(2);
    });
});
