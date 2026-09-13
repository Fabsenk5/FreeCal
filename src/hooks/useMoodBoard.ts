/**
 * useMoodBoard — single board with all pins, vote/comment aggregates and
 * signed image URLs.
 *
 * useMoodBoardComments — comments of one pin, loaded on demand (the pin
 * detail view is the only consumer).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchMoodBoard,
  fetchMoodBoardComments,
  MoodBoardComment,
  MoodBoardDetail,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export function useMoodBoard(boardId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ['mood-board', boardId, userId],
    queryFn: async (): Promise<MoodBoardDetail> => {
      if (!boardId || !userId) throw new Error('Not authenticated');
      try {
        return await fetchMoodBoard(boardId, userId);
      } catch (err) {
        console.error('Error fetching mood board:', err);
        throw err;
      }
    },
    enabled: !!boardId && !!userId,
  });

  // Refetch the board and the overview (pin count/activity may change).
  const refreshBoard = () => {
    void queryClient.invalidateQueries({ queryKey: ['mood-board', boardId] });
    void queryClient.invalidateQueries({ queryKey: ['mood-boards'] });
  };

  return {
    board: query.data?.board ?? null,
    items: query.data?.items ?? [],
    loading: query.isLoading,
    error: query.error,
    refreshBoard,
  };
}

export function useMoodBoardComments(itemId?: string, enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['mood-board-comments', itemId],
    queryFn: async (): Promise<MoodBoardComment[]> => {
      if (!itemId) throw new Error('Missing item id');
      try {
        return await fetchMoodBoardComments(itemId);
      } catch (err) {
        console.error('Error fetching mood board comments:', err);
        throw err;
      }
    },
    enabled: !!itemId && enabled,
  });

  const refreshComments = () => {
    void queryClient.invalidateQueries({ queryKey: ['mood-board-comments', itemId] });
  };

  return { comments: query.data ?? [], loading: query.isLoading, refreshComments };
}
