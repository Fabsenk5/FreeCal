import { useEffect, useRef, useState } from 'react';
import { Images, Plus } from 'lucide-react';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BoardCard } from '@/components/moodboards/BoardCard';
import { BoardFormDialog } from '@/components/moodboards/BoardFormDialog';
import { useMoodBoards } from '@/hooks/useMoodBoards';

const PAGE_SIZE = 6;

/**
 * Boards overview (bottom-nav tab): 2-column tile grid, first batch of 6
 * boards, then loads more while scrolling.
 */
export function MoodBoards() {
    const { boards, loading, refreshBoards } = useMoodBoards();
    const [showCreate, setShowCreate] = useState(false);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const element = sentinelRef.current;
        if (!element) return;
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0]?.isIntersecting) {
                    setVisibleCount(count => Math.min(count + PAGE_SIZE, boards.length));
                }
            },
            { rootMargin: '200px' },
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [boards.length]);

    const visibleBoards = boards.slice(0, visibleCount);
    const hasMore = visibleCount < boards.length;

    return (
        <div className="flex h-screen flex-col bg-background">
            <MobileHeader
                title="Boards"
                rightAction={
                    <Button size="sm" className="h-8 px-2.5 text-xs" onClick={() => setShowCreate(true)}>
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        New
                    </Button>
                }
            />

            <div className="flex-1 overflow-y-auto px-4 pb-24 pt-3">
                {loading ? (
                    <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="space-y-2">
                                <Skeleton className="aspect-square w-full rounded-xl" />
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        ))}
                    </div>
                ) : boards.length === 0 ? (
                    <div className="flex h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
                        <Images className="h-12 w-12 text-muted-foreground/30" />
                        <div className="space-y-1">
                            <h3 className="font-medium">No boards yet</h3>
                            <p className="text-sm text-muted-foreground">
                                Collect shopping, interior or outfit ideas and share them with your contacts.
                            </p>
                        </div>
                        <Button onClick={() => setShowCreate(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create board
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            {visibleBoards.map(board => (
                                <BoardCard key={board.id} board={board} />
                            ))}
                        </div>
                        {hasMore && <div ref={sentinelRef} className="h-12" />}
                        {hasMore && (
                            <div className="flex justify-center pt-3">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        setVisibleCount(count => Math.min(count + PAGE_SIZE, boards.length))
                                    }
                                >
                                    Load more
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <BoardFormDialog open={showCreate} onOpenChange={setShowCreate} onSaved={refreshBoards} />
        </div>
    );
}

export default MoodBoards;
