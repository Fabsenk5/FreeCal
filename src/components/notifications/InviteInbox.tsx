
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Bell, Check, X, Calendar, MapPin } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { useRelationships } from '@/hooks/useRelationships';
import { api, EventWithAttendees } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export function InviteInbox() {
    const { events, refreshEvents } = useEvents();
    const { relationships } = useRelationships();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [pendingInvites, setPendingInvites] = useState<EventWithAttendees[]>([]);

    useEffect(() => {
        if (!user || !events) return;

        // Filter events where I am an attendee AND status is 'pending'
        const pending = events.filter(event => {
            const myDetails = event.attendees_details?.find(d => d.userId === user.id);
            // Also exclude events I created (should be implicitly accepted, but check anyway)
            const isCreator = event.user_id === user.id;
            return !isCreator && myDetails?.status === 'pending';
        });

        setPendingInvites(pending);
    }, [events, user]);

    const handleRespond = async (eventId: string, status: 'accepted' | 'declined') => {
        try {
            await api.put(`/events/${eventId}/respond`, { status });
            toast.success(status === 'accepted' ? 'Event accepted!' : 'Event declined');
            refreshEvents(); // Reload events to update status/list

            // Optimistic update
            setPendingInvites(prev => prev.filter(e => e.id !== eventId));
        } catch (error) {
            console.error(error);
            toast.error('Failed to respond to invite');
        }
    };

    const getCreatorName = (userId: string) => {
        const rel = relationships.find(r => r.profile.id === userId);
        return rel ? rel.profile.display_name : 'Unknown User';
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    };

    if (!user) return null;

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <button className="relative p-2 rounded-full hover:bg-muted transition-colors">
                    <Bell className="w-5 h-5" />
                    {pendingInvites.length > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    )}
                </button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Invitations ({pendingInvites.length})</SheetTitle>
                </SheetHeader>

                <div className="mt-6 space-y-4">
                    {pendingInvites.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            <p>No pending invitations</p>
                        </div>
                    ) : (
                        pendingInvites.map(event => (
                            <div key={event.id} className="p-4 rounded-xl border bg-card space-y-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-semibold">{event.title}</h3>
                                        <p className="text-xs text-muted-foreground">
                                            Invited by <span className="font-medium text-primary">{event.creator_name || getCreatorName(event.user_id)}</span>
                                        </p>
                                    </div>
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: event.color }} />
                                </div>

                                <div className="space-y-1 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-3 h-3" />
                                        <span>{formatDate(event.start_time)}</span>
                                    </div>
                                    {event.location && (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-3 h-3" />
                                            <span>{event.location}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                        onClick={() => handleRespond(event.id, 'accepted')}
                                    >
                                        <Check className="w-4 h-4 mr-1" /> Accept
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 text-destructive hover:bg-destructive/10"
                                        onClick={() => handleRespond(event.id, 'declined')}
                                    >
                                        <X className="w-4 h-4 mr-1" /> Decline
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
