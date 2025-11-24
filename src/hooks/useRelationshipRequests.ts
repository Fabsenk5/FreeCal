import { useState, useEffect, useCallback } from 'react';
import { supabase, Relationship, Profile } from '@/lib/supabase';
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
      // Fetch pending requests where current user is the receiver (related_user_id)
      const { data: requests, error } = await supabase
        .from('relationships')
        .select('*')
        .eq('related_user_id', user.id)
        .eq('status', 'pending');

      if (error) {
        console.error('Error fetching pending requests:', error);
        toast.error(`Database Error: ${error.message}`, {
          description: 'Copy this error and paste in chat for help',
          duration: 10000,
        });
        return;
      }

      if (!requests || requests.length === 0) {
        setPendingRequests([]);
        return;
      }

      // Get sender profile IDs
      const senderIds = requests.map((req) => req.user_id);

      // Fetch sender profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', senderIds);

      if (profilesError) {
        console.error('Error fetching sender profiles:', profilesError);
        toast.error(`Database Error: ${profilesError.message}`, {
          description: 'Copy this error and paste in chat for help',
          duration: 10000,
        });
        return;
      }

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const requestsWithProfiles: RelationshipRequestWithProfile[] = requests
        .map((req) => {
          const senderProfile = profileMap.get(req.user_id);
          if (!senderProfile) return null;
          return {
            ...req,
            sender_profile: senderProfile,
          };
        })
        .filter((req): req is RelationshipRequestWithProfile => req !== null);

      setPendingRequests(requestsWithProfiles);
    } catch (err) {
      console.error('Unexpected error fetching pending requests:', err);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
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
      const { error } = await supabase
        .from('relationships')
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) {
        toast.error(`Database Error: ${error.message}`, {
          description: 'Copy this error and paste in chat for help',
          duration: 10000,
        });
        return false;
      }

      toast.success('Request accepted!', {
        description: 'You can now see each other\'s calendars and find free time together!',
      });

      await fetchPendingRequests();
      return true;
    } catch (err) {
      console.error('Error accepting request:', err);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
      return false;
    }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('relationships')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) {
        toast.error(`Database Error: ${error.message}`, {
          description: 'Copy this error and paste in chat for help',
          duration: 10000,
        });
        return false;
      }

      toast.success('Request rejected', {
        description: 'The request has been declined.',
      });

      await fetchPendingRequests();
      return true;
    } catch (err) {
      console.error('Error rejecting request:', err);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
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