/**
 * useMoodBoards — overview list of mood boards (owned + shared).
 *
 * Query key: ['mood-boards', userId]; refreshBoards invalidates the whole
 * prefix so every mounted consumer updates after a mutation.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMoodBoards, MoodBoardSummary } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type { MoodBoardSummary };

export function useMoodBoards() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ['mood-boards', userId],
    queryFn: async (): Promise<MoodBoardSummary[]> => {
      if (!userId) throw new Error('Not authenticated');
      try {
        return await fetchMoodBoards(userId);
      } catch (err) {
        console.error('Error fetching mood boards:', err);
        toast.error(`Sync Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        throw err;
      }
    },
    enabled: !!userId,
  });

  const refreshBoards = () => {
    void queryClient.invalidateQueries({ queryKey: ['mood-boards'] });
  };

  return { boards: query.data ?? [], loading: query.isLoading, refreshBoards };
}
