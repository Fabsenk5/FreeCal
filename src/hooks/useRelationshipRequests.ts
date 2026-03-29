import { useState, useEffect, useCallback } from 'react';
import { fetchRelationships as fetchRelationshipsApi, updateRelationship as updateRelationshipApi, Relationship, Profile } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface RelationshipRequestWithProfile extends Relationship {
  sender_profile: Profile;
}

export function useRelationshipRequests() {
  const [pendingRequests, setPendingRequests] = useState<RelationshipRequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchPendingRequests = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const data = await fetchRelationshipsApi(user.id, 'pending');

      // Filter for those where I am the RECEIVER
      const requests = data.filter((rel: any) => rel.related_user_id === user.id);

      const requestsWithProfiles = requests.map((req: any) => ({
        ...req,
        sender_profile: req.profile,
      }));

      setPendingRequests(requestsWithProfiles);
    } catch (err: any) {
      console.error('Error fetching pending requests:', err);
      toast.error(`Error: ${err.message}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  const acceptRequest = async (requestId: string) => {
    try {
      await updateRelationshipApi(requestId, 'accepted');
      toast.success('Request accepted!', {
        description: "You can now see each other's calendars and find free time together!",
      });
      await fetchPendingRequests();
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
      await fetchPendingRequests();
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
    fetchPendingRequests();
  };

  return {
    pendingRequests,
    loading,
    acceptRequest,
    rejectRequest,
    refreshRequests,
  };
}