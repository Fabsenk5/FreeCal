import { useState, useEffect, useCallback } from 'react';
import { fetchRelationships as fetchRelationshipsApi, Relationship, Profile } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface RelationshipWithProfile extends Relationship {
  profile: Profile;
}

export function useRelationships() {
  const [relationships, setRelationships] = useState<RelationshipWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchRelationshipsData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const data = await fetchRelationshipsApi(user.id, 'accepted');
      setRelationships(data);
    } catch (err: any) {
      console.error('Error fetching relationships:', err);
      toast.error(`Error: ${err.message}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRelationshipsData();
  }, [fetchRelationshipsData]);

  const refreshRelationships = () => {
    fetchRelationshipsData();
  };

  return { relationships, loading, refreshRelationships };
}