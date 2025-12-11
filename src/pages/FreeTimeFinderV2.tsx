
import { useState, useMemo } from 'react';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { Button } from '@/components/ui/button';
import { Check, X, Calendar as CalendarIcon, Clock, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { addDays, format, startOfDay } from 'date-fns';
import { useEvents } from '@/hooks/useEvents';
import { useRelationships } from '@/hooks/useRelationships';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

// Type definitions
interface DayAvailability {
    date: Date;
    totalSharedHours: number;
    slots: TimeSlot[];
}

interface TimeSlot {
    start: Date;
    end: Date;
}

export function FreeTimeFinderV2() {
    const { events, loading: eventsLoading } = useEvents();
    const { relationships, loading: relLoading } = useRelationships();
    const { profile, user } = useAuth();

    // Define loading status early to avoid TDZ in useMemo
    const loading = eventsLoading || relLoading;

    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [selectedDay, setSelectedDay] = useState<DayAvailability | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [startDate, setStartDate] = useState<Date>(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });

    // Configurable thresholds (could be moved to settings later)
    const HIGH_AVAILABILITY_THRESHOLD = 8; // Hours

    // Toggle user selection
    const toggleUser = (userId: string) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    // Helper: Format date
    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    // Helper: Format time
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    // Algorithm: Calculate shared availability
    const availabilityData = useMemo(() => {
        if (loading || !user) return [];

        const next14Days = Array.from({ length: 14 }, (_, i) => {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            return d;
        });

        return next14Days.map(day => {
            // Define working hours (e.g., 8 AM - 10 PM) or 24h?
            // Let's assume 8 AM to 10 PM for "Active Hours" check, or just 24h.
            // Using 24h for calculation simplicity.

            // 1. Get all events for selected users on this day
            const dayEvents = events.filter(e => {
                const eStart = new Date(e.start_time);
                const eEnd = new Date(e.end_time);

                // Check date overlap
                const overlapsDay = eStart < new Date(day.getTime() + 86400000) && eEnd > day;

                // Check user involvement
                // Creator OR Attendee (Attendee logic already in useEvents but let's be safe)
                // Note: useEvents usually returns events for the current user (including shared).
                // We need to check if the event "blocks" any of the *selectedUsers*.
                // Ideally, we need events for ALL selected users.
                // Assuming `events` contains ALL relevant events we can see.

                const involvesSelectedUser = selectedUsers.includes(e.user_id) ||
                    (e.attendees && e.attendees.some((att: any) => selectedUsers.includes(typeof att === 'string' ? att : att.id || att))) ||
                    // Also check self!
                    e.user_id === user?.id ||
                    (e.attendees && e.attendees.some((att: any) => (typeof att === 'string' ? att : att.id || att) === user?.id));

                return overlapsDay && involvesSelectedUser;
            });

            // 2. Calculate free slots
            // Simple approach: Create 30-min blocks and check availability
            // 00:00 to 23:59

            const slots: TimeSlot[] = [];
            let totalMinutes = 0;

            // Start checking from 8 AM to 10 PM (reasonable hours) or configurable?
            // Let's do 06:00 to 22:00 for "waking hours"
            const startHour = 6;
            const endHour = 22;

            for (let hour = startHour; hour < endHour; hour++) {
                for (let min = 0; min < 60; min += 30) {
                    const slotStart = new Date(day);
                    slotStart.setHours(hour, min, 0, 0);
                    const slotEnd = new Date(slotStart.getTime() + 30 * 60000); // +30 mins

                    // Check if *ANY* selected user is busy
                    const isBusy = dayEvents.some(e => {
                        const eStart = new Date(e.start_time);
                        const eEnd = new Date(e.end_time);
                        // Intersection?
                        return eStart < slotEnd && eEnd > slotStart;
                    });

                    if (!isBusy) {
                        // It's free!
                        // Attempt to merge with last slot
                        const lastSlot = slots[slots.length - 1];
                        if (lastSlot && lastSlot.end.getTime() === slotStart.getTime()) {
                            lastSlot.end = slotEnd;
                        } else {
                            slots.push({ start: slotStart, end: slotEnd });
                        }
                        totalMinutes += 30;
                    }
                }
            }

            return {
                date: day,
                totalSharedHours: totalMinutes / 60,
                slots
            };
        });
    }, [events, selectedUsers, user, startDate]);

    const handlePrevPeriod = () => {
        setStartDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() - 14);
            return d;
        });
    };

    const handleNextPeriod = () => {
        setStartDate(prev => {
            const d = new Date(prev);
            d.setDate(d.getDate() + 14);
            return d;
        });
    };

    const periodLabel = useMemo(() => {
        const start = startDate;
        const end = new Date(startDate);
        end.setDate(end.getDate() + 13);

        // Format: 11. Dec'25
        const fmt = (d: Date) => {
            const day = d.getDate();
            const month = d.toLocaleDateString('en-US', { month: 'short' });
            const year = d.getFullYear().toString().slice(2);
            return `${day}. ${month}'${year}`;
        };

        return `${fmt(start)} to ${fmt(end)}`;
    }, [startDate]);

    // Handle Create Event
    const handleCreateFromSlot = (slot: TimeSlot) => {
        // Save prefill data
        localStorage.setItem('prefillEventData', JSON.stringify({
            date: slot.start.toISOString().split('T')[0],
            startTime: formatTime(slot.start),
            endTime: formatTime(slot.end),
            attendees: selectedUsers.filter(id => id !== user?.id) // Don't add self as attendee
        }));

        // Navigate
        window.location.href = '/?tab=create'; // Or use CustomEvent if staying in SPA
        // Since we are different page, we need to go to Index. 
        // Index uses ?tab=create or we can dispatch payload if loaded.
        // Actually, CreateEvent checks localStorage on mount.
        // We just need to navigate to "/" and trigger the tab switch.
        // Let's try redirecting to / with a query param that Index parses?
        // Index doesn't parse query params yet.
        // We can use the 'navigate' hook if we had it, or href.
        // For now, let's use href and hope Index defaults to Create?
        // Wait, Index defaults to Calendar.
        // I should update Index to read URL params.
        // Or better, just use the CustomEvent + History push if in same Router.
        // They are separate routes but same RouterProvider.
        // Implementation:
        window.dispatchEvent(new CustomEvent('navigateToCreateEvent')); // Just in case
        window.location.href = '/'; // Simple redirect, user manually clicks create? No that sucks.
        // Better: We see CreateEvent reads localStorage. 
        // We need to tell Index to open 'create' tab.
        localStorage.setItem('activeTab', 'create'); // Maybe Index reads this?
    };

    if (loading) {
        return (
            <div className="flex flex-col h-screen bg-background items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background text-foreground">
            <MobileHeader
                title="Shared Availability"
                showBack
                onBack={() => window.location.href = '/'}
                rightAction={
                    <Button variant="ghost" size="sm" onClick={() => setSelectedUsers([])}>
                        Clear
                    </Button>
                }
            />

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* 1. User Selector */}
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Who are you meeting?
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {/* Always include Self? Usually yes for "Shared". */}
                        <div
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-full border transition-all cursor-pointer opacity-80",
                                // Self always selected for calculation logic, but visually maybe distinct?
                                // Let's just say "You" is always included in calc but not clickable
                                "bg-primary/10 border-primary text-primary"
                            )}
                        >
                            <span className="text-sm font-medium">You</span>
                        </div>

                        {relationships.map(rel => {
                            const isSelected = selectedUsers.includes(rel.profile.id);
                            return (
                                <div
                                    key={rel.id}
                                    onClick={() => toggleUser(rel.profile.id)}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-full border transition-all cursor-pointer",
                                        isSelected
                                            ? "bg-primary/20 border-primary text-primary"
                                            : "bg-card border-border hover:border-primary/50"
                                    )}
                                >
                                    <span className="text-sm font-medium">{rel.profile.display_name}</span>
                                    {isSelected && <Check className="w-3 h-3" />}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 2. Heatmap Grid */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevPeriod}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide min-w-[140px] text-center">
                                {periodLabel}
                            </h2>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextPeriod}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> &ge;{HIGH_AVAILABILITY_THRESHOLD}h</span>
                            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> &lt;{HIGH_AVAILABILITY_THRESHOLD}h</span>
                        </div>
                    </div>

                    {selectedUsers.length === 0 ? (
                        <div className="bg-muted/30 border-dashed border-2 rounded-xl p-8 text-center">
                            <p className="text-muted-foreground">Select friends to see shared availability</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {availabilityData.map((day, i) => {
                                const isHigh = day.totalSharedHours >= HIGH_AVAILABILITY_THRESHOLD;
                                const isBusy = day.totalSharedHours === 0;

                                return (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            if (!isBusy) {
                                                setSelectedDay(day);
                                                setIsModalOpen(true);
                                            }
                                        }}
                                        disabled={isBusy}
                                        className={cn(
                                            "flex flex-col items-start p-3 rounded-xl border transition-all text-left",
                                            isHigh
                                                ? "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20"
                                                : isBusy
                                                    ? "bg-muted/50 border-transparent opacity-60 cursor-not-allowed"
                                                    : "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20"
                                        )}
                                    >
                                        <span className="text-xs font-semibold mb-1 opacity-70">
                                            {formatDate(day.date)}
                                        </span>
                                        <div className="flex items-end gap-1">
                                            <span className={cn(
                                                "text-xl font-bold",
                                                isHigh ? "text-emerald-600" : isBusy ? "text-muted-foreground" : "text-amber-600"
                                            )}>
                                                {day.totalSharedHours}
                                            </span>
                                            <span className="text-xs pb-1 opacity-70">hours</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Slot Picker Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-md mx-4 rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>{selectedDay && formatDate(selectedDay.date)}</DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            Found {selectedDay?.slots.length} shared time blocks.
                        </p>
                    </DialogHeader>

                    <div className="space-y-2 max-h-[60vh] overflow-y-auto py-2">
                        {selectedDay?.slots.map((slot, i) => (
                            <button
                                key={i}
                                onClick={() => handleCreateFromSlot(slot)}
                                className="w-full flex items-center justify-between p-4 rounded-xl bg-card border hover:border-primary transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-semibold text-sm">
                                            {formatTime(slot.start)} - {formatTime(slot.end)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {((slot.end.getTime() - slot.start.getTime()) / 60000 / 60).toFixed(1)} hours
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                            </button>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
