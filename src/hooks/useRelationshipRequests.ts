import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Relationship, Profile } from '@/lib/supabase';

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
      // Fetch all pending relationships
      const { data } = await api.get('/relationships?status=pending');

      // Filter for those where I am the RECEIVER (related_user_id)
      const requests = data.filter((rel: any) => rel.related_user_id === user.id);

      // The backend returns 'profile' which is the OTHER person.
      // So for these requests, 'profile' IS the sender profile.
      const requestsWithProfiles = requests.map((req: any) => ({
        ...req,
        sender_profile: req.profile
      }));

      setPendingRequests(requestsWithProfiles);
    } catch (err: any) {
      console.error('Unexpected error fetching pending requests:', err);
      toast.error(`Error: ${err.response?.data?.message || err.message}`, {
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
      await api.put(`/relationships/${requestId}`, { status: 'accepted' });

      toast.success('Request accepted!', {
        description: 'You can now see each other\'s calendars and find free time together!',
      });

      await fetchPendingRequests();
      return true;
    } catch (err: any) {
      console.error('Error accepting request:', err);
      toast.error(`Error: ${err.response?.data?.message || err.message}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
      return false;
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      // Rejecting usually just updates status to 'rejected'
      await api.put(`/relationships/${requestId}`, { status: 'rejected' });

      toast.success('Request rejected', {
        description: 'The request has been declined.',
      });

      await fetchPendingRequests();
      return true;
    } catch (err: any) {
      console.error('Error rejecting request:', err);
      toast.error(`Error: ${err.response?.data?.message || err.message}`, {
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