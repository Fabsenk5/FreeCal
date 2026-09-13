import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, Loader2, Pencil, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
    addMoodBoardComment,
    deleteMoodBoardComment,
    deleteMoodBoardItem,
    MoodBoardItem,
    updateMoodBoardItem,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useMoodBoardComments } from '@/hooks/useMoodBoard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SafeImage } from './SafeImage';
import { PinVoteButtons } from './PinVoteButtons';
import { InitialAvatar } from './InitialAvatar';
import { formatMoodBoardPrice } from './labels';

interface PinDetailDialogProps {
    item: MoodBoardItem | null;
    open: boolean;
    /** Board owner: may edit/delete any pin and moderate comments. */
    canModerate: boolean;
    onClose: () => void;
    onChanged: () => void;
    onDeleted: () => void;
}

export function PinDetailDialog({ item, open, canModerate, onClose, onChanged, onDeleted }: PinDetailDialogProps) {
    const { user } = useAuth();
    const { comments, loading: commentsLoading, refreshComments } = useMoodBoardComments(item?.id, open && !!item);
    const [editing, setEditing] = useState(false);
    const [note, setNote] = useState('');
    const [link, setLink] = useState('');
    const [price, setPrice] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [posting, setPosting] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    if (!item) return null;

    const isUploader = !!user && item.user_id === user.id;
    const canEdit = isUploader || canModerate;
    const priceLabel = formatMoodBoardPrice(item.price);

    const startEditing = () => {
        setNote(item.note ?? '');
        setLink(item.link_url ?? '');
        setPrice(item.price === null ? '' : String(item.price));
        setEditing(true);
    };

    const handleSaveEdit = async () => {
        if (savingEdit) return;
        let parsedPrice: number | null = null;
        if (price.trim()) {
            parsedPrice = Number(price.replace(',', '.'));
            if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
                toast.error('Invalid price');
                return;
            }
        }

        setSavingEdit(true);
        try {
            await updateMoodBoardItem(item.id, { note, link_url: link, price: parsedPrice });
            toast.success('Pin updated');
            setEditing(false);
            onChanged();
        } catch (err) {
            console.error('Failed to update pin:', err);
            toast.error('Failed to update pin');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteMoodBoardItem(item.id);
            toast.success('Pin deleted');
            setConfirmDeleteOpen(false);
            onDeleted();
        } catch (err) {
            console.error('Failed to delete pin:', err);
            toast.error('Failed to delete pin');
        }
    };

    const handleAddComment = async () => {
        if (!user || posting || !commentText.trim()) return;
        setPosting(true);
        try {
            await addMoodBoardComment(item.id, user.id, commentText);
            setCommentText('');
            refreshComments();
            onChanged();
        } catch (err) {
            console.error('Failed to post comment:', err);
            toast.error('Failed to post comment');
        } finally {
            setPosting(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        try {
            await deleteMoodBoardComment(commentId);
            refreshComments();
            onChanged();
        } catch (err) {
            console.error('Failed to delete comment:', err);
            toast.error('Failed to delete comment');
        }
    };

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={nextOpen => {
                    if (!nextOpen) {
                        setEditing(false);
                        onClose();
                    }
                }}
            >
                <DialogContent className="max-h-[92vh] max-w-[92%] overflow-y-auto rounded-xl">
                    <DialogHeader>
                        <DialogTitle className="sr-only">Pin details</DialogTitle>
                    </DialogHeader>

                    <div className="overflow-hidden rounded-lg bg-muted">
                        <SafeImage
                            src={item.image_url || item.preview_url}
                            alt={item.note ?? 'Pin'}
                            className="max-h-[45vh] w-full object-contain"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="text-xs text-muted-foreground">
                                    {item.uploader_name} ·{' '}
                                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                </p>
                                {priceLabel && <p className="text-sm font-semibold">{priceLabel}</p>}
                            </div>
                            <PinVoteButtons item={item} onChanged={onChanged} />
                        </div>

                        {editing ? (
                            <div className="space-y-2 rounded-lg border border-border p-3">
                                <Input
                                    placeholder="Note"
                                    value={note}
                                    onChange={event => setNote(event.target.value)}
                                    disabled={savingEdit}
                                />
                                <Input
                                    placeholder="Product link"
                                    value={link}
                                    onChange={event => setLink(event.target.value)}
                                    disabled={savingEdit}
                                />
                                <Input
                                    type="number"
                                    step="0.01"
                                    inputMode="decimal"
                                    placeholder="Price"
                                    value={price}
                                    onChange={event => setPrice(event.target.value)}
                                    disabled={savingEdit}
                                />
                                <div className="flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={savingEdit}>
                                        Cancel
                                    </Button>
                                    <Button size="sm" onClick={() => void handleSaveEdit()} disabled={savingEdit}>
                                        {savingEdit && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                                        Save
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {item.note && <p className="text-sm">{item.note}</p>}
                                {item.link_url && (
                                    <a
                                        href={item.link_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                        Product link
                                    </a>
                                )}
                                {canEdit && (
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={startEditing}>
                                            <Pencil className="mr-1 h-3.5 w-3.5" />
                                            Edit
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => setConfirmDeleteOpen(true)}
                                        >
                                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                                            Delete
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="border-t border-border pt-3">
                            <h4 className="mb-2 text-sm font-semibold">Comments</h4>
                            {commentsLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : comments.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No comments yet.</p>
                            ) : (
                                <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
                                    {comments.map(comment => (
                                        <div key={comment.id} className="flex gap-2">
                                            <InitialAvatar
                                                name={comment.author_name}
                                                color={comment.author_color}
                                                className="h-6 w-6 text-[10px]"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="truncate text-xs font-semibold">
                                                        {comment.author_name}
                                                    </span>
                                                    <span className="shrink-0 text-[10px] text-muted-foreground">
                                                        {formatDistanceToNow(new Date(comment.created_at), {
                                                            addSuffix: true,
                                                        })}
                                                    </span>
                                                </div>
                                                <p className="text-xs">{comment.content}</p>
                                            </div>
                                            {(canModerate || comment.user_id === user?.id) && (
                                                <button
                                                    type="button"
                                                    onClick={() => void handleDeleteComment(comment.id)}
                                                    className="self-start p-1 text-muted-foreground transition-colors hover:text-destructive"
                                                    aria-label="Delete comment"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="mt-3 flex gap-2">
                                <Input
                                    value={commentText}
                                    onChange={event => setCommentText(event.target.value)}
                                    placeholder="Add a comment..."
                                    onKeyDown={event => {
                                        if (event.key === 'Enter') void handleAddComment();
                                    }}
                                    disabled={posting}
                                />
                                <Button
                                    size="icon"
                                    onClick={() => void handleAddComment()}
                                    disabled={posting || !commentText.trim()}
                                    aria-label="Post comment"
                                >
                                    {posting ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this pin?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The image and all its comments and votes will be removed. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => void handleDelete()}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
