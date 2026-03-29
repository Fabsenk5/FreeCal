/**
 * useEvents Hook — Supabase Edition
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchEvents, EventWithAttendees } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type { EventWithAttendees };

export function useEvents() {
  const [events, setEvents] = useState<EventWithAttendees[]>(() => {
    try {
      const cached = localStorage.getItem('cached_events');
      const parsed = cached ? JSON.parse(cached) : null;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(() => !localStorage.getItem('cached_events'));
  const { user } = useAuth();

  const fetchEventsData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const data = await fetchEvents(user.id);
      setEvents(data);
      try {
        localStorage.setItem('cached_events', JSON.stringify(data));
      } catch (e) {
        console.warn('Failed to save events to cache', e);
      }
    } catch (err: any) {
      console.error('Error fetching events:', err);
      toast.error(`Sync Error: ${err.message}`, {
        description: 'Using cached/offline data if available.',
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEventsData();
  }, [fetchEventsData]);

  const refreshEvents = () => {
    fetchEventsData();
  };

  return { events, loading, refreshEvents };
}