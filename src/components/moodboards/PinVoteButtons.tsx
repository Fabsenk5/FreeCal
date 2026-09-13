import { useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { MoodBoardItem, setMoodBoardVote } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PinVoteButtonsProps {
    item: MoodBoardItem;
    onChanged: () => void;
    className?: string;
}

/**
 * Thumbs up/down for one pin. One vote per user: tapping the active thumb
 * again removes the vote (handled in setMoodBoardVote).
 */
export function PinVoteButtons({ item, onChanged, className }: PinVoteButtonsProps) {
    const { user } = useAuth();
    const [pending, setPending] = useState(false);

    const vote = async (value: -1 | 1) => {
        if (!user || pending) return;
        setPending(true);
        try {
            await setMoodBoardVote(item.id, user.id, value);
            onChanged();
        } catch (err) {
            console.error('Failed to vote:', err);
            toast.error('Vote failed');
        } finally {
            setPending(false);
        }
    };

    return (
        <div className={cn('flex items-center gap-1', className)}>
            <button
                type="button"
                disabled={pending}
                onClick={event => {
                    event.stopPropagation();
                    void vote(1);
                }}
                aria-label="Thumbs up"
                className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors disabled:opacity-50',
                    item.my_vote === 1
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
            >
                <ThumbsUp className="h-3.5 w-3.5" />
                {item.up_votes}
            </button>
            <button
                type="button"
                disabled={pending}
                onClick={event => {
                    event.stopPropagation();
                    void vote(-1);
                }}
                aria-label="Thumbs down"
                className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors disabled:opacity-50',
                    item.my_vote === -1
                        ? 'bg-destructive/10 text-destructive'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
            >
                <ThumbsDown className="h-3.5 w-3.5" />
                {item.down_votes}
            </button>
        </div>
    );
}
