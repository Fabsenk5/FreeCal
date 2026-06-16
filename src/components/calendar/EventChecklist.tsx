import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Trash } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChecklistItem {
    id: string;
    title: string;
    isCompleted: boolean;
}

export function EventChecklist({ eventId }: { eventId: string }) {
    const [items, setItems] = useState<ChecklistItem[]>([]);
    const [newItem, setNewItem] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchChecklist();
    }, [eventId]);

    const fetchChecklist = async () => {
        try {
            const data = await api.get(`/events/${eventId}/checklist`);
            setItems(data);
        } catch (error) {
            console.error('Failed to load checklist', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async () => {
        if (!newItem.trim()) return;
        try {
            const added = await api.post(`/events/${eventId}/checklist`, { title: newItem });
            setItems([...items, added]);
            setNewItem('');
        } catch (error) {
            console.error('Failed to add checklist item', error);
        }
    };

    const handleToggleItem = async (id: string, isCompleted: boolean) => {
        try {
            // Optimistic update
            setItems(items.map(item => item.id === id ? { ...item, isCompleted } : item));
            await api.put(`/checklists/${id}`, { isCompleted });
        } catch (error) {
            console.error('Failed to update checklist item', error);
            fetchChecklist(); // Revert
        }
    };

    const handleDeleteItem = async (id: string) => {
        try {
            setItems(items.filter(item => item.id !== id));
            await api.delete(`/checklists/${id}`);
        } catch (error) {
            console.error('Failed to delete item', error);
            fetchChecklist(); // Revert
        }
    }

    if (loading) return <Loader2 className="w-4 h-4 animate-spin mx-auto mt-4" />;

    return (
        <div className="flex flex-col h-[300px]">
            <ScrollArea className="flex-1 pr-4">
                <div className="space-y-2">
                    {items.map(item => (
                        <div key={item.id} className="flex items-center gap-2 group">
                            <Checkbox 
                                checked={item.isCompleted} 
                                onCheckedChange={(checked) => handleToggleItem(item.id, checked as boolean)}
                            />
                            <span className={`flex-1 text-sm ${item.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                {item.title}
                            </span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteItem(item.id)}>
                                <Trash className="w-3 h-3 text-destructive" />
                            </Button>
                        </div>
                    ))}
                    {items.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center mt-4">Checklist is empty.</p>
                    )}
                </div>
            </ScrollArea>
            <div className="flex gap-2 mt-4 pt-2 border-t">
                <Input 
                    value={newItem} 
                    onChange={e => setNewItem(e.target.value)}
                    placeholder="Add an item..."
                    onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                />
                <Button onClick={handleAddItem}>Add</Button>
            </div>
        </div>
    );
}
