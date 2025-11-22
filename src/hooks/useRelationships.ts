import { useState, useEffect, useCallback } from 'react';
import { supabase, Relationship, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
      // Fetch relationships where user is the creator or the related user
      const { data: userRelationships, error: userRelError } = await supabase
        .from('relationships')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      const { data: relatedRelationships, error: relatedRelError } = await supabase
        .from('relationships')
        .select('*')
        .eq('related_user_id', user.id)
        .eq('status', 'accepted');

      if (userRelError) {
        console.error('Error fetching user relationships:', userRelError);
        toast.error(`Database Error: ${userRelError.message}`, {
          description: 'Copy this error and paste in chat for help',
          duration: 10000,
        });
        return;
      }

      if (relatedRelError) {
        console.error('Error fetching related relationships:', relatedRelError);
      }

      const allRelationships = [
        ...(userRelationships || []),
        ...(relatedRelationships || []),
      ];

      // Get profile IDs
      const profileIds = allRelationships.map((rel) =>
        rel.user_id === user.id ? rel.related_user_id : rel.user_id
      );

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', profileIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        toast.error(`Database Error: ${profilesError.message}`, {
          description: 'Copy this error and paste in chat for help',
          duration: 10000,
        });
        return;
      }

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const relationshipsWithProfiles: RelationshipWithProfile[] = allRelationships
        .map((rel) => {
          const profileId = rel.user_id === user.id ? rel.related_user_id : rel.user_id;
          const profile = profileMap.get(profileId);
          if (!profile) return null;
          return {
            ...rel,
            profile,
          };
        })
        .filter((rel): rel is RelationshipWithProfile => rel !== null);

      setRelationships(relationshipsWithProfiles);
    } catch (err) {
      console.error('Unexpected error fetching relationships:', err);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
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