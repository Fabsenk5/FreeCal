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
import { supabase, Event } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Extended event type with additional metadata
 * Includes attendee/viewer lists and creator information
 */
export interface EventWithAttendees extends Event {
  /** Array of user IDs who are attendees (blocks their calendar) */
  attendees?: string[];
  /** Array of user IDs who are viewers (can see event, doesn't block calendar) */
  viewers?: string[];
  /** Display name of the event creator */
  creator_name?: string;
  /** Calendar color of the event creator */
  creator_color?: string;
  /** Whether current user is only a viewer (not creator or attendee) */
  isViewer?: boolean;
}

/**
 * Hook for fetching and managing calendar events
 * 
 * @returns {Object} Events data and utilities
 * @returns {EventWithAttendees[]} events - Array of events visible to current user
 * @returns {boolean} loading - Loading state during initial fetch
 * @returns {Function} refreshEvents - Function to manually refetch events
 */
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
      // Fetch user's own events
      const { data: userEvents, error: userEventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id);

      if (userEventsError) {
        console.error('Error fetching user events:', userEventsError);
        toast.error(`Database Error: ${userEventsError.message}`, {
          description: 'Copy this error and paste in chat for help',
          duration: 10000,
        });
        return;
      }

      // Fetch events where user is an attendee
      const { data: attendeeEvents, error: attendeeError } = await supabase
        .from('event_attendees')
        .select('event_id')
        .eq('user_id', user.id);

      if (attendeeError) {
        console.error('Error fetching attendee events:', attendeeError);
      }

      const attendeeEventIds = attendeeEvents?.map((a) => a.event_id) || [];

      // Fetch events where user is a viewer
      const { data: viewerEvents, error: viewerError } = await supabase
        .from('event_viewers')
        .select('event_id')
        .eq('user_id', user.id);

      if (viewerError) {
        console.error('Error fetching viewer events:', viewerError);
      }

      const viewerEventIds = viewerEvents?.map((v) => v.event_id) || [];

      // Combine all event IDs and remove duplicates
      const allEventIds = [...new Set([...attendeeEventIds, ...viewerEventIds])];

      let otherEvents: Event[] = [];
      if (allEventIds.length > 0) {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .in('id', allEventIds)
          .neq('user_id', user.id);

        if (error) {
          console.error('Error fetching other events:', error);
        } else {
          otherEvents = data || [];
        }
      }

      // Combine and fetch creator info
      const allEvents = [...(userEvents || []), ...otherEvents];
      const creatorIds = [...new Set(allEvents.map((e) => e.user_id))];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, calendar_color')
        .in('id', creatorIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // Fetch attendees and viewers for each event
      const eventsWithDetails: EventWithAttendees[] = await Promise.all(
        allEvents.map(async (event) => {
          const { data: attendees } = await supabase
            .from('event_attendees')
            .select('user_id')
            .eq('event_id', event.id);

          const { data: viewers } = await supabase
            .from('event_viewers')
            .select('user_id')
            .eq('event_id', event.id);

          const creator = profileMap.get(event.user_id);
          
          // Determine if current user is only a viewer
          const attendeeIds = attendees?.map((a) => a.user_id) || [];
          const viewerIds = viewers?.map((v) => v.user_id) || [];
          const isCreator = event.user_id === user?.id;
          const isAttendee = attendeeIds.includes(user?.id || '');
          const isViewer = viewerIds.includes(user?.id || '') && !isCreator && !isAttendee;
          
          return {
            ...event,
            attendees: attendeeIds,
            viewers: viewerIds,
            creator_name: creator?.display_name,
            creator_color: creator?.calendar_color || 'hsl(217, 91%, 60%)',
            isViewer,
          };
        })
      );

      setEvents(eventsWithDetails);
    } catch (err) {
      console.error('Unexpected error fetching events:', err);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
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