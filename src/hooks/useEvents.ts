import { useState, useEffect, useCallback } from 'react';
import { supabase, Event } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface EventWithAttendees extends Event {
  attendees?: string[];
  creator_name?: string;
  creator_color?: string;
}

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

      let otherEvents: Event[] = [];
      if (attendeeEventIds.length > 0) {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .in('id', attendeeEventIds)
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

      // Fetch attendees for each event
      const eventsWithDetails: EventWithAttendees[] = await Promise.all(
        allEvents.map(async (event) => {
          const { data: attendees } = await supabase
            .from('event_attendees')
            .select('user_id')
            .eq('event_id', event.id);

          const creator = profileMap.get(event.user_id);
          
          return {
            ...event,
            attendees: attendees?.map((a) => a.user_id) || [],
            creator_name: creator?.display_name,
            creator_color: creator?.calendar_color || 'hsl(217, 91%, 60%)',
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