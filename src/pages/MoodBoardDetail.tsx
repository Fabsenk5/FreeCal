import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ImagePlus, Loader2, LogOut, MoreVertical, Pencil, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteMoodBoard, removeMoodBoardMember } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useMoodBoard } from '@/hooks/useMoodBoard';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PinCard } from '@/components/moodboards/PinCard';
import { PinDetailDialog } from '@/components/moodboards/PinDetailDialog';
import { AddPinDialog } from '@/components/moodboards/AddPinDialog';
import { BoardFormDialog } from '@/components/moodboards/BoardFormDialog';
import { ShareBoardDialog } from '@/components/moodboards/ShareBoardDialog';
import { InitialAvatar } from '@/components/moodboards/InitialAvatar';
import { MOOD_BOARD_CATEGORY_LABELS } from '@/components/moodboards/labels';

export function MoodBoardDetail() {
    const { boardId } = useParams<{ boardId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { board, items, loading, error, refreshBoard } = useMoodBoard(boardId);
    const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
    const [showAddPin, setShowAddPin] = useState(false);
    const [showEditBoard, setShowEditBoard] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    const goToBoards = () => navigate('/?tab=boards');

    const selectedPin = items.find(item => item.id === selectedPinId) ?? null;

    if (loading) {
        return (
            <div className="flex h-screen flex-col bg-background">
                <MobileHeader title="Board" showBack onBack={goToBoards} />
                <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            </div>
        );
    }

    if (error || !board) {
        return (
            <div className="flex h-screen flex-col bg-background">
                <MobileHeader title="Board" showBack onBack={goToBoards} />
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                    <h2 className="text-lg font-semibold">Board not found</h2>
                    <p className="text-sm text-muted-foreground">
                        It may have been deleted or is not shared with you.
                    </p>
                    <Button variant="outline" onClick={goToBoards}>
                        Back to boards
                    </Button>
                </div>
            </div>
        );
    }

    const canEdit = board.is_owner || board.my_role === 'editor';

    const handleLeave = async () => {
        if (!user) return;
        try {
            await removeMoodBoardMember(board.id, user.id);
            toast.success('You left the board');
            goToBoards();
        } catch (err) {
            console.error('Failed to leave board:', err);
            toast.error('Failed to leave board');
        }
    };

    const handleDeleteBoard = async () => {
        try {
            await deleteMoodBoard(board.id);
            toast.success('Board deleted');
            setConfirmDeleteOpen(false);
            goToBoards();
        } catch (err) {
            console.error('Failed to delete board:', err);
            toast.error('Failed to delete board');
        }
    };

    return (
        <div className="flex h-screen flex-col bg-background">
            <MobileHeader
                title={board.title}
                showBack
                onBack={goToBoards}
                rightAction={
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {board.is_owner ? (
                                <>
                                    <DropdownMenuItem onClick={() => setShowEditBoard(true)}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit board
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setShowShare(true)}>
                                        <Share2 className="mr-2 h-4 w-4" />
                                        Share
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="text-destructive"
                                        onClick={() => setConfirmDeleteOpen(true)}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete board
                                    </DropdownMenuItem>
                                </>
                            ) : (
                                <DropdownMenuItem className="text-destructive" onClick={() => void handleLeave()}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Leave board
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                }
            />

            <div className="flex-1 overflow-y-auto px-4 pb-10 pt-3">
                <div className="mb-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{MOOD_BOARD_CATEGORY_LABELS[board.category]}</Badge>
                        {board.is_owner ? (
                            <Badge variant="outline">Owner</Badge>
                        ) : (
                            <Badge variant="outline">
                                {board.my_role === 'editor' ? 'Editor' : 'Viewer'}
                            </Badge>
                        )}
                    </div>
                    {board.description && (
                        <p className="text-sm text-muted-foreground">{board.description}</p>
                    )}
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                            {board.members.slice(0, 5).map(member => (
                                <InitialAvatar
                                    key={member.user_id}
                                    name={member.display_name}
                                    color={member.calendar_color}
                                    className="h-7 w-7 border-2 border-background text-[10px]"
                                />
                            ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {board.is_owner ? 'You' : board.owner_name} · {board.members.length + 1}{' '}
                            {board.members.length + 1 === 1 ? 'member' : 'members'}
                        </span>
                    </div>
                </div>

                {canEdit && (
                    <button
                        type="button"
                        onClick={() => setShowAddPin(true)}
                        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                    >
                        <ImagePlus className="h-4 w-4" />
                        Add pins
                    </button>
                )}

                {items.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                        No pins yet.{canEdit ? ' Add the first idea!' : ''}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {items.map(item => (
                            <PinCard
                                key={item.id}
                                item={item}
                                onOpen={() => setSelectedPinId(item.id)}
                                onChanged={refreshBoard}
                            />
                        ))}
                    </div>
                )}
            </div>

            <AddPinDialog
                boardId={board.id}
                open={showAddPin}
                onOpenChange={setShowAddPin}
                onUploaded={refreshBoard}
            />
            <BoardFormDialog
                open={showEditBoard}
                onOpenChange={setShowEditBoard}
                board={board}
                onSaved={refreshBoard}
            />
            <ShareBoardDialog
                board={board}
                open={showShare}
                onOpenChange={setShowShare}
                onChanged={refreshBoard}
            />
            <PinDetailDialog
                item={selectedPin}
                open={!!selectedPin}
                canModerate={board.is_owner}
                onClose={() => setSelectedPinId(null)}
                onChanged={refreshBoard}
                onDeleted={() => {
                    setSelectedPinId(null);
                    refreshBoard();
                }}
            />

            <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this board?</AlertDialogTitle>
                        <AlertDialogDescription>
                            All pins, comments and votes will be removed for everyone. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => void handleDeleteBoard()}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default MoodBoardDetail;
