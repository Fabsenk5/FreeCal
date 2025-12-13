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

export type { EventWithAttendees };



export function useEvents() {
  // Initialize from cache if available
  const [events, setEvents] = useState<EventWithAttendees[]>(() => {
    try {
      const cached = localStorage.getItem('cached_events');
      // basic validation: ensure it's an array
      const parsed = cached ? JSON.parse(cached) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to parse cached events', e);
      return [];
    }
  });

  // If we have cached events, we aren't "loading" in the blocking sense.
  // We can add an `isRefetching` state later if needed.
  const [loading, setLoading] = useState(() => {
    const hasCache = !!localStorage.getItem('cached_events');
    return !hasCache;
  });

  const { user } = useAuth();

  const fetchEvents = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get('/events');
      setEvents(data);
      // Update cache
      try {
        localStorage.setItem('cached_events', JSON.stringify(data));
      } catch (e) {
        console.warn('Failed to save events to cache', e);
      }
    } catch (err: any) {
      console.error('Unexpected error fetching events:', err);
      // Only show error toast if we have NO data to show.
      // If we have cached data, failing silently (or less intrusively) might be better?
      // For now, keeping the toast but letting the user see cached data.
      toast.error(`Sync Error: ${err.response?.data?.message || err.message}`, {
        description: 'Using cached/offline data if available.',
        duration: 5000,
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