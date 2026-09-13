import { useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadMoodBoardItem } from '@/lib/api';
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

interface AddPinDialogProps {
    boardId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUploaded: () => void;
}

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif';

export function AddPinDialog({ boardId, open, onOpenChange, onUploaded }: AddPinDialogProps) {
    const { user } = useAuth();
    const [files, setFiles] = useState<File[]>([]);
    const [note, setNote] = useState('');
    const [link, setLink] = useState('');
    const [price, setPrice] = useState('');
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const reset = () => {
        setFiles([]);
        setNote('');
        setLink('');
        setPrice('');
        setProgress({ current: 0, total: 0 });
    };

    const handleUpload = async () => {
        if (!user || uploading) return;
        if (files.length === 0) {
            toast.error('Please choose at least one image');
            return;
        }

        let parsedPrice: number | null = null;
        if (price.trim()) {
            parsedPrice = Number(price.replace(',', '.'));
            if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
                toast.error('Invalid price');
                return;
            }
        }

        setUploading(true);
        setProgress({ current: 0, total: files.length });
        let uploaded = 0;
        try {
            for (const file of files) {
                await uploadMoodBoardItem(boardId, user.id, file, {
                    note,
                    link_url: link,
                    price: parsedPrice,
                });
                uploaded += 1;
                setProgress({ current: uploaded, total: files.length });
            }
            toast.success(uploaded === 1 ? 'Pin added' : `${uploaded} pins added`);
            reset();
            onUploaded();
            onOpenChange(false);
        } catch (err) {
            console.error('Failed to upload pin:', err);
            toast.error(err instanceof Error ? err.message : 'Upload failed');
            // Refresh for the pins that made it through before the error.
            if (uploaded > 0) onUploaded();
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={nextOpen => {
                if (!uploading) {
                    if (!nextOpen) reset();
                    onOpenChange(nextOpen);
                }
            }}
        >
            <DialogContent className="max-w-[92%] rounded-xl">
                <DialogHeader>
                    <DialogTitle>Add pins</DialogTitle>
                    <DialogDescription>
                        Images are compressed to WebP before upload. Note, link and price apply to all selected images.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-6 transition-colors hover:border-primary/50 hover:bg-muted/50">
                        <ImagePlus className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                            {files.length > 0
                                ? `${files.length} image${files.length === 1 ? '' : 's'} selected`
                                : 'Choose images'}
                        </span>
                        <input
                            type="file"
                            accept={ACCEPTED_TYPES}
                            multiple
                            className="hidden"
                            onChange={event => setFiles(Array.from(event.target.files ?? []))}
                            disabled={uploading}
                        />
                    </label>
                    {files.length > 0 && (
                        <p className="truncate text-xs text-muted-foreground">{files.map(file => file.name).join(', ')}</p>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="pin-note">Note (optional)</Label>
                        <Input
                            id="pin-note"
                            value={note}
                            onChange={event => setNote(event.target.value)}
                            placeholder="e.g. Great sofa for the living room"
                            disabled={uploading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pin-link">Product link (optional)</Label>
                        <Input
                            id="pin-link"
                            value={link}
                            onChange={event => setLink(event.target.value)}
                            placeholder="https://..."
                            disabled={uploading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pin-price">Price (optional)</Label>
                        <Input
                            id="pin-price"
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            value={price}
                            onChange={event => setPrice(event.target.value)}
                            placeholder="e.g. 249.00"
                            disabled={uploading}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
                        Cancel
                    </Button>
                    <Button onClick={() => void handleUpload()} disabled={uploading || files.length === 0}>
                        {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {uploading ? `Uploading ${progress.current}/${progress.total}` : 'Upload'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
