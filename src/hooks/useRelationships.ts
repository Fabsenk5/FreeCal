import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchRelationships as fetchRelationshipsApi, Relationship, Profile } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface RelationshipWithProfile extends Relationship {
  profile: Profile;
}

export function useRelationships() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ['relationships', userId],
    queryFn: async (): Promise<RelationshipWithProfile[]> => {
      try {
        return await fetchRelationshipsApi(userId!, 'accepted');
      } catch (err: any) {
        console.error('Error fetching relationships:', err);
        toast.error(`Error: ${err.message}`, {
          description: 'Copy this error and paste in chat for help',
          duration: 10000,
        });
        throw err;
      }
    },
    enabled: !!userId,
  });

  // Invalidate so every mounted consumer of the relationships queries refetches.
  const refreshRelationships = () => {
    void queryClient.invalidateQueries({ queryKey: ['relationships'] });
  };

  return { relationships: query.data ?? [], loading: query.isLoading, refreshRelationships };
}
