import { MessageCircle } from 'lucide-react';
import { MoodBoardItem } from '@/lib/api';
import { SafeImage } from './SafeImage';
import { PinVoteButtons } from './PinVoteButtons';
import { formatMoodBoardPrice } from './labels';

interface PinCardProps {
    item: MoodBoardItem;
    onOpen: () => void;
    onChanged: () => void;
}

export function PinCard({ item, onOpen, onChanged }: PinCardProps) {
    const price = formatMoodBoardPrice(item.price);

    return (
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
            <button
                type="button"
                onClick={onOpen}
                className="relative block aspect-square w-full overflow-hidden bg-muted text-left"
            >
                <SafeImage
                    src={item.preview_url}
                    alt={item.note ?? 'Pin'}
                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                />
                {price && (
                    <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                        {price}
                    </span>
                )}
            </button>
            <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                {item.note && <p className="line-clamp-2 text-xs leading-snug">{item.note}</p>}
                <div className="mt-auto flex items-center justify-between">
                    <PinVoteButtons item={item} onChanged={onChanged} />
                    <button
                        type="button"
                        onClick={onOpen}
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        <MessageCircle className="h-3.5 w-3.5" />
                        {item.comments_count}
                    </button>
                </div>
            </div>
        </div>
    );
}
