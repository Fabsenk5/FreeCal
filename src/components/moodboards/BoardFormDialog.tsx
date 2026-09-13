import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    createMoodBoard,
    MoodBoardCategory,
    MoodBoardSummary,
    updateMoodBoard,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MOOD_BOARD_CATEGORY_LABELS } from './labels';

interface BoardFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Set to edit an existing board, omit to create a new one. */
    board?: MoodBoardSummary | null;
    onSaved: () => void;
}

const CATEGORIES: MoodBoardCategory[] = ['shopping', 'interior', 'outfit', 'other'];

export function BoardFormDialog({ open, onOpenChange, board, onSaved }: BoardFormDialogProps) {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState<MoodBoardCategory>('other');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setTitle(board?.title ?? '');
        setDescription(board?.description ?? '');
        setCategory(board?.category ?? 'other');
    }, [open, board]);

    const handleSubmit = async () => {
        if (!user || saving) return;
        if (!title.trim()) {
            toast.error('Please enter a title');
            return;
        }

        setSaving(true);
        try {
            if (board) {
                await updateMoodBoard(board.id, { title, description, category });
                toast.success('Board updated');
            } else {
                await createMoodBoard(user.id, { title, description, category });
                toast.success('Board created');
            }
            onSaved();
            onOpenChange(false);
        } catch (err) {
            console.error('Failed to save board:', err);
            toast.error(err instanceof Error ? err.message : 'Failed to save board');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[92%] rounded-xl">
                <DialogHeader>
                    <DialogTitle>{board ? 'Edit board' : 'New board'}</DialogTitle>
                    <DialogDescription>
                        {board
                            ? 'Update title, description and category.'
                            : 'Collect shopping, interior or outfit ideas.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="mood-board-title">Title</Label>
                        <Input
                            id="mood-board-title"
                            value={title}
                            onChange={event => setTitle(event.target.value)}
                            placeholder="e.g. Living room inspiration"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="mood-board-description">Description (optional)</Label>
                        <Textarea
                            id="mood-board-description"
                            value={description}
                            onChange={event => setDescription(event.target.value)}
                            placeholder="What is this board about?"
                            rows={3}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={category} onValueChange={value => setCategory(value as MoodBoardCategory)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map(value => (
                                    <SelectItem key={value} value={value}>
                                        {MOOD_BOARD_CATEGORY_LABELS[value]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={() => void handleSubmit()} disabled={saving}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {board ? 'Save' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
