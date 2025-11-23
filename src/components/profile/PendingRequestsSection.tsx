import { useRelationshipRequests } from '@/hooks/useRelationshipRequests';
import { useRelationships } from '@/hooks/useRelationships';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, Clock, Send } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SentRequest {
  id: string;
  related_user_id: string;
  status: string;
  created_at: string;
  receiver_profile: {
    id: string;
    display_name: string;
    email: string;
    calendar_color: string;
  };
}

export function PendingRequestsSection() {
  const { user } = useAuth();
  const { pendingRequests, loading, acceptRequest, rejectRequest } = useRelationshipRequests();
  const { refreshRelationships } = useRelationships();
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [sentLoading, setSentLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  // Fetch sent requests (where current user is the sender)
  const fetchSentRequests = async () => {
    if (!user) return;

    try {
      const { data: requests, error } = await supabase
        .from('relationships')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending');

      if (error) {
        console.error('Error fetching sent requests:', error);
        return;
      }

      if (!requests || requests.length === 0) {
        setSentRequests([]);
        setSentLoading(false);
        return;
      }

      // Get receiver profile IDs
      const receiverIds = requests.map((req) => req.related_user_id);

      // Fetch receiver profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', receiverIds);

      if (profilesError) {
        console.error('Error fetching receiver profiles:', profilesError);
        return;
      }

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      const requestsWithProfiles: SentRequest[] = requests
        .map((req) => {
          const receiverProfile = profileMap.get(req.related_user_id);
          if (!receiverProfile) return null;
          return {
            id: req.id,
            related_user_id: req.related_user_id,
            status: req.status,
            created_at: req.created_at,
            receiver_profile: receiverProfile,
          };
        })
        .filter((req): req is SentRequest => req !== null);

      setSentRequests(requestsWithProfiles);
    } catch (err) {
      console.error('Unexpected error fetching sent requests:', err);
    } finally {
      setSentLoading(false);
    }
  };

  // Fetch sent requests on mount
  useEffect(() => {
    fetchSentRequests();
  }, [user]);

  const handleAccept = async (requestId: string) => {
    setProcessing(requestId);
    await acceptRequest(requestId);
    await refreshRelationships();
    setProcessing(null);
  };

  const handleReject = async (requestId: string) => {
    setProcessing(requestId);
    await rejectRequest(requestId);
    setProcessing(null);
  };

  const handleCancelRequest = async (requestId: string, receiverName: string) => {
    try {
      const { error } = await supabase
        .from('relationships')
        .delete()
        .eq('id', requestId);

      if (error) {
        toast.error(`Database Error: ${error.message}`, {
          description: 'Copy this error and paste in chat for help',
          duration: 10000,
        });
        return;
      }

      toast.success('Request cancelled', {
        description: `Your request to ${receiverName} has been cancelled.`,
      });

      fetchSentRequests();
    } catch (err) {
      console.error('Error cancelling request:', err);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
    }
  };

  if (loading && sentLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (pendingRequests.length === 0 && sentRequests.length === 0) {
    return null;
  }

  return (
    <div className="pb-6">
      <h2 className="text-lg font-bold mb-4">Pending Requests</h2>

      {/* Received Requests */}
      {pendingRequests.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Received</h3>
            <Badge variant="secondary" className="text-xs">
              {pendingRequests.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="bg-card rounded-xl p-4 flex items-center gap-3"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-primary-foreground shadow-sm"
                    style={{ backgroundColor: request.sender_profile.calendar_color }}
                  >
                    {request.sender_profile.display_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">
                      {request.sender_profile.display_name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {request.sender_profile.email}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReject(request.id)}
                    disabled={processing === request.id}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAccept(request.id)}
                    disabled={processing === request.id}
                  >
                    {processing === request.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sent Requests */}
      {sentRequests.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Sent</h3>
            <Badge variant="secondary" className="text-xs">
              {sentRequests.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {sentRequests.map((request) => (
              <div
                key={request.id}
                className="bg-card rounded-xl p-4 flex items-center gap-3"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-primary-foreground shadow-sm"
                    style={{ backgroundColor: request.receiver_profile.calendar_color }}
                  >
                    {request.receiver_profile.display_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">
                      {request.receiver_profile.display_name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {request.receiver_profile.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Pending
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCancelRequest(
                        request.id,
                        request.receiver_profile.display_name
                      )
                    }
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}