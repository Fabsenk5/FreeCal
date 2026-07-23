/**
 * useEvents Hook — TanStack Query Edition (P3)
 *
 * P6: the old localStorage mirror ('cached_events') was removed — it synced the
 * full events array to localStorage on every fetch (main-thread JSON cost,
 * 5 MB quota, double render). The query cache now covers in-session reuse.
 * Trade-off (accepted): a cold start while offline no longer shows stale
 * events; a service-worker cache for Supabase REST is planned separately.
 */
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchEvents, EventWithAttendees, FetchEventsOptions } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type { EventWithAttendees };

export function useEvents(opts?: FetchEventsOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Serialize the optional range into the query key as ISO strings so the key
  // stays structurally stable across renders (Date object identities change).
  // Wiring an actual range in CalendarView is left to a later wave; callers
  // without opts share the single ['events', userId, null] query.
  const rangeKey =
    opts?.rangeStart || opts?.rangeEnd
      ? {
          rangeStart: opts.rangeStart ? opts.rangeStart.toISOString() : null,
          rangeEnd: opts.rangeEnd ? opts.rangeEnd.toISOString() : null,
        }
      : null;

  const query = useQuery({
    queryKey: ['events', userId, rangeKey],
    queryFn: async (): Promise<EventWithAttendees[]> => {
      try {
        return await fetchEvents(userId!, opts);
      } catch (err: any) {
        console.error('Error fetching events:', err);
        toast.error(`Sync Error: ${err.message}`, {
          description: 'Using cached/offline data if available.',
          duration: 5000,
        });
        throw err;
      }
    },
    enabled: !!userId,
    // Avoid flicker when the key changes (e.g. future range switches): keep
    // showing the previous data until the new fetch resolves.
    placeholderData: keepPreviousData,
  });

  // Invalidate (not just local refetch) so every mounted consumer of the
  // events queries updates after a mutation, regardless of range variant.
  const refreshEvents = () => {
    void queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  return { events: query.data ?? [], loading: query.isLoading, refreshEvents };
}
