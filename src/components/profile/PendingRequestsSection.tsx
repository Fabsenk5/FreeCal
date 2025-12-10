import { useRelationshipRequests } from '@/hooks/useRelationshipRequests';
import { useRelationships } from '@/hooks/useRelationships';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2, Clock, Send } from 'lucide-react';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
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
      const { data } = await api.get('/relationships?status=pending');

      // Filter for those where I am the SENDER (user_id)
      const requests = data.filter((rel: any) => rel.user_id === user.id);

      // 'profile' key matches the 'other' person, which is receiver
      const requestsWithProfiles = requests.map((req: any) => ({
        id: req.id,
        related_user_id: req.related_user_id,
        status: req.status,
        created_at: req.created_at,
        receiver_profile: req.profile,
      }));

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
      await api.delete(`/relationships/${requestId}`);

      toast.success('Request cancelled', {
        description: `Your request to ${receiverName} has been cancelled.`,
      });

      fetchSentRequests();
    } catch (err: any) {
      console.error('Error cancelling request:', err);
      toast.error(`Error: ${err.response?.data?.message || err.message}`, {
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