/**
 * useEvents Hook
 * 
 * Custom hook for fetching and managing calendar events.
 * 
 * This hook fetches all events visible to the current user, including:
 * - Events created by the user (user is owner)
 * - Events where user is an attendee (blocks calendar)
 * - Events where user is a viewer (visibility only, doesn't block calendar)
 * 
 * The hook automatically fetches events when the user changes and provides
 * a refresh function to manually refetch events after mutations.
 * 
 * @example
 * ```typescript
 * const { events, loading, refreshEvents } = useEvents()
 * 
 * // Use events in your component
 * events.map(event => <EventCard event={event} />)
 * 
 * // Refresh after creating/updating an event
 * await createEvent(...)
 * refreshEvents()
 * ```
 * 
 * @module hooks/useEvents
 */

import { useState, useEffect, useCallback } from 'react';
import { api, User, EventWithAttendees } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';



export function useEvents() {
  const [events, setEvents] = useState<EventWithAttendees[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchEvents = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get('/events');
      setEvents(data);
    } catch (err: any) {
      console.error('Unexpected error fetching events:', err);
      toast.error(`Error: ${err.response?.data?.message || err.message}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const refreshEvents = () => {
    fetchEvents();
  };

  return { events, loading, refreshEvents };
}