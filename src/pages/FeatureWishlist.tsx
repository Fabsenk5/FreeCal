import { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Plus, Trash2, CheckCircle2, Circle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

interface Wish {
    id: string;
    title: string;
    status: 'pending' | 'completed';
    createdAt: string;
}

const ADMIN_EMAIL = 'fabiank5@hotmail.com';

export function FeatureWishlist() {
    const { user } = useAuth();
    const [wishes, setWishes] = useState<Wish[]>([]);
    const [loading, setLoading] = useState(true);
    const [newItem, setNewItem] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isAdmin = user?.email === ADMIN_EMAIL;

    useEffect(() => {
        fetchWishes();
    }, []);

    const fetchWishes = async () => {
        try {
            const { data } = await api.get('/feature-wishes');
            setWishes(data);
        } catch (error) {
            console.error('Failed to fetch wishes:', error);
            toast.error('Failed to load wishlist');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newItem.trim()) return;
        setIsSubmitting(true);
        try {
            await api.post('/feature-wishes', { title: newItem });
            setNewItem('');
            toast.success('Wish added!');
            fetchWishes();
        } catch (error) {
            console.error('Failed to add wish:', error);
            toast.error('Failed to add wish');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this wish?')) return;
        try {
            await api.delete(`/feature-wishes/${id}`);
            toast.success('Wish deleted');
            setWishes(prev => prev.filter(w => w.id !== id));
        } catch (error) {
            console.error('Failed to delete wish:', error);
            toast.error('Failed to delete wish');
        }
    };

    const handleToggleStatus = async (wish: Wish) => {
        if (!isAdmin) return;

        const newStatus = wish.status === 'pending' ? 'completed' : 'pending';
        // Optimistic update
        setWishes(prev => prev.map(w => w.id === wish.id ? { ...w, status: newStatus } : w));

        try {
            await api.put(`/feature-wishes/${wish.id}/status`, { status: newStatus });
        } catch (error) {
            console.error('Failed to update status:', error);
            toast.error('Failed to update status');
            // Revert
            fetchWishes();
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col h-screen bg-background items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading wishlist...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            <MobileHeader
                title="Feature Wishlist"
                showBack
                onBack={() => window.location.href = '/'}
            />

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 p-6 rounded-xl border border-indigo-500/20">
                    <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent mb-2">
                        Dream Big!
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Here is a list of features we are planning or dreaming about.
                    </p>
                </div>

                {isAdmin && (
                    <div className="flex gap-2">
                        <Input
                            placeholder="Add a new feature idea..."
                            value={newItem}
                            onChange={(e) => setNewItem(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        />
                        <Button
                            onClick={handleAdd}
                            disabled={isSubmitting || !newItem.trim()}
                            className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0"
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                )}

                <div className="space-y-3">
                    {wishes.map((wish) => (
                        <div
                            key={wish.id}
                            className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${wish.status === 'completed'
                                    ? 'bg-muted/30 border-transparent opacity-70'
                                    : 'bg-card border-border'
                                }`}
                        >
                            <button
                                onClick={() => handleToggleStatus(wish)}
                                disabled={!isAdmin}
                                className={`mt-0.5 ${isAdmin ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
                            >
                                {wish.status === 'completed' ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                ) : (
                                    <Circle className="w-5 h-5 text-muted-foreground" />
                                )}
                            </button>

                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${wish.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                                    {wish.title}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(wish.createdAt).toLocaleDateString()}
                                </p>
                            </div>

                            {isAdmin && (
                                <button
                                    onClick={() => handleDelete(wish.id)}
                                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}

                    {wishes.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground">
                            <p>No wishes yet. Start dreaming!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
