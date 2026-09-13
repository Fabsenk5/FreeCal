import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Images, Users } from 'lucide-react';
import { MoodBoardSummary } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { BoardPreviewMosaic } from './BoardPreviewMosaic';
import { MOOD_BOARD_CATEGORY_LABELS } from './labels';

export function BoardCard({ board }: { board: MoodBoardSummary }) {
    // Owner is not part of mood_board_members — add them for the count.
    const memberCount = board.members.length + 1;

    return (
        <Link
            to={`/boards/${board.id}`}
            className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-md active:scale-[0.99]"
        >
            <BoardPreviewMosaic images={board.preview_images} />
            <div className="flex flex-1 flex-col gap-1 p-2.5">
                <div className="flex items-start justify-between gap-1.5">
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:underline">
                        {board.title}
                    </h3>
                    {!board.is_owner && (
                        <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                            Shared
                        </Badge>
                    )}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{MOOD_BOARD_CATEGORY_LABELS[board.category]}</span>
                    <span>{formatDistanceToNow(new Date(board.updated_at), { addSuffix: true })}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Images className="h-3 w-3" />
                        {board.item_count}
                    </span>
                    <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {memberCount}
                    </span>
                </div>
            </div>
        </Link>
    );
}
