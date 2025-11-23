import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserPlus, Check, X, Loader2 } from 'lucide-react';
import { useRelationshipRequests } from '@/hooks/useRelationshipRequests';
import { useAuth } from '@/contexts/AuthContext';

export function RelationshipRequestModal() {
  const { user } = useAuth();
  const { pendingRequests, loading, acceptRequest, rejectRequest, refreshRelationships } = useRelationshipRequests();
  const [isOpen, setIsOpen] = useState(false);
  const [currentRequestIndex, setCurrentRequestIndex] = useState(0);
  const [processing, setProcessing] = useState(false);

  // Show modal when there are pending requests
  useEffect(() => {
    if (!loading && pendingRequests.length > 0) {
      setIsOpen(true);
      setCurrentRequestIndex(0);
    } else {
      setIsOpen(false);
    }
  }, [loading, pendingRequests.length]);

  const currentRequest = pendingRequests[currentRequestIndex];

  const handleAccept = async () => {
    if (!currentRequest) return;

    setProcessing(true);
    const success = await acceptRequest(currentRequest.id);
    setProcessing(false);

    if (success) {
      // Refresh relationships list
      refreshRelationships();
      
      // Move to next request or close modal
      if (currentRequestIndex + 1 < pendingRequests.length) {
        setCurrentRequestIndex(currentRequestIndex + 1);
      } else {
        setIsOpen(false);
      }
    }
  };

  const handleReject = async () => {
    if (!currentRequest) return;

    setProcessing(true);
    const success = await rejectRequest(currentRequest.id);
    setProcessing(false);

    if (success) {
      // Move to next request or close modal
      if (currentRequestIndex + 1 < pendingRequests.length) {
        setCurrentRequestIndex(currentRequestIndex + 1);
      } else {
        setIsOpen(false);
      }
    }
  };

  if (!user || loading || !currentRequest) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-[90%] sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Relationship Request
          </DialogTitle>
          <DialogDescription>
            {pendingRequests.length > 1 && (
              <span className="text-xs">
                {currentRequestIndex + 1} of {pendingRequests.length} requests
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-primary-foreground shadow-lg"
              style={{ backgroundColor: currentRequest.sender_profile.calendar_color }}
            >
              {currentRequest.sender_profile.display_name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold mb-1">
                {currentRequest.sender_profile.display_name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {currentRequest.sender_profile.email}
              </p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-center">
              <span className="font-semibold">
                {currentRequest.sender_profile.display_name}
              </span>{' '}
              wants to connect with you to share calendar events and coordinate schedules.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleReject}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <X className="w-4 h-4 mr-2" />
              )}
              Decline
            </Button>
            <Button
              className="flex-1"
              onClick={handleAccept}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Accept
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}