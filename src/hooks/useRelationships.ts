import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Relationship, Profile } from '@/lib/api';

export interface RelationshipWithProfile extends Relationship {
  profile: Profile;
}

export function useRelationships() {
  const [relationships, setRelationships] = useState<RelationshipWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchRelationships = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get('/relationships?status=accepted');
      // Backend now returns the profile joined, properly mapped.
      setRelationships(data);
    } catch (err: any) {
      console.error('Unexpected error fetching relationships:', err);
      toast.error(`Error: ${err.response?.data?.message || err.message} `, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchRelationships();
  }, [fetchRelationships]);

  const refreshRelationships = () => {
    fetchRelationships();
  };

  return { relationships, loading, refreshRelationships };
}