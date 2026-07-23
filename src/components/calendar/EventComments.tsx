import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Comment {
    id: string;
    userId: string;
    content: string;
    createdAt: string;
    user: {
        displayName: string;
    };
}

export function EventComments({ eventId }: { eventId: string }) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        fetchComments();
    }, [eventId]);

    const fetchComments = async () => {
        setLoading(true);
        setLoadError(false);
        try {
            const data = await api.get(`/events/${eventId}/comments`);
            setComments(data);
        } catch (error) {
            console.error('Failed to load comments', error);
            setLoadError(true);
            toast.error('Failed to load comments', {
                description: 'The server may be starting up — please try again.',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim() || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const added = await api.post(`/events/${eventId}/comments`, { content: newComment });
            setComments([added, ...comments]); // add to top
            setNewComment('');
        } catch (error) {
            console.error('Failed to add comment', error);
            // Keep the typed text so the user can retry without retyping.
            toast.error('Failed to post comment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <Loader2 className="w-4 h-4 animate-spin mx-auto mt-4" />;

    if (loadError) {
        return (
            <div className="flex flex-col items-center justify-center h-[300px] gap-3">
                <p className="text-sm text-muted-foreground">Comments could not be loaded.</p>
                <Button variant="outline" size="sm" onClick={fetchComments}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[300px]">
            <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                    {comments.map(comment => (
                        <div key={comment.id} className="bg-muted p-3 rounded-lg text-sm">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-xs">{comment.user?.displayName || 'Someone'}</span>
                                <span className="text-[10px] text-muted-foreground">{format(new Date(comment.createdAt), 'MMM d, h:mm a')}</span>
                            </div>
                            <p>{comment.content}</p>
                        </div>
                    ))}
                    {comments.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center mt-4">No comments yet. Start the conversation!</p>
                    )}
                </div>
            </ScrollArea>
            <div className="flex gap-2 mt-4 pt-2 border-t">
                <Input 
                    value={newComment} 
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                />
                <Button onClick={handleAddComment} disabled={isSubmitting || !newComment.trim()}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Post'}
                </Button>
            </div>
        </div>
    );
}
