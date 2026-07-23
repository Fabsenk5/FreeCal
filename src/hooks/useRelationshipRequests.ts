import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchRelationships as fetchRelationshipsApi, updateRelationship as updateRelationshipApi, Relationship, Profile } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface RelationshipRequestWithProfile extends Relationship {
  sender_profile: Profile;
}

export function useRelationshipRequests() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const query = useQuery({
    queryKey: ['relationship-requests', userId],
    queryFn: async (): Promise<RelationshipRequestWithProfile[]> => {
      try {
        const data = await fetchRelationshipsApi(userId!, 'pending');

        // Filter for those where I am the RECEIVER
        const requests = data.filter((rel: any) => rel.related_user_id === userId);

        return requests.map((req: any) => ({
          ...req,
          sender_profile: req.profile,
        }));
      } catch (err: any) {
        console.error('Error fetching pending requests:', err);
        toast.error(`Error: ${err.message}`, {
          description: 'Copy this error and paste in chat for help',
          duration: 10000,
        });
        throw err;
      }
    },
    enabled: !!userId,
  });

  const acceptRequest = async (requestId: string) => {
    try {
      await updateRelationshipApi(requestId, 'accepted');
      toast.success('Request accepted!', {
        description: "You can now see each other's calendars and find free time together!",
      });
      // An accepted request changes both the pending-requests list and the
      // accepted-relationships list — invalidate both, everywhere.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['relationship-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['relationships'] }),
      ]);
      return true;
    } catch (err: any) {
      console.error('Error accepting request:', err);
      toast.error(`Error: ${err.message}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
      return false;
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      await updateRelationshipApi(requestId, 'rejected');
      toast.success('Request rejected', {
        description: 'The request has been declined.',
      });
      await queryClient.invalidateQueries({ queryKey: ['relationship-requests'] });
      return true;
    } catch (err: any) {
      console.error('Error rejecting request:', err);
      toast.error(`Error: ${err.message}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
      return false;
    }
  };

  const refreshRequests = () => {
    void queryClient.invalidateQueries({ queryKey: ['relationship-requests'] });
  };

  return {
    pendingRequests: query.data ?? [],
    loading: query.isLoading,
    acceptRequest,
    rejectRequest,
    refreshRequests,
  };
}
