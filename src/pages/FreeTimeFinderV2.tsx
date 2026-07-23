
import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { Button } from '@/components/ui/button';
import { Check, Clock, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { useEvents } from '@/hooks/useEvents';
import { useRelationships } from '@/hooks/useRelationships';
import { useValentineEvent } from '@/hooks/useValentineEvent';
import { useBirthdayEvent } from '@/hooks/useBirthdayEvent';
import { useAuth } from '@/contexts/AuthContext';
import { expandRecurringEvents } from '@/utils/recurrence';
import { eventBlocksUser, isSpecialEvent } from './freeTimeFinderUtils';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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
    const { events: rawEvents, loading: eventsLoading } = useEvents();
    // Inject special events (birthday/valentine) — same pattern as CalendarView
    const valentineEvents = useValentineEvent(rawEvents);
    const eventsWithSpecials = useBirthdayEvent(valentineEvents);
    const { relationships, loading: relLoading } = useRelationships();
    const { profile, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    // True when rendered as the standalone /free-time-v2 route instead of an Index tab
    const isStandaloneRoute = location.pathname === '/free-time-v2';

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

        // Expand recurring events across the visible 14-day range so series
        // occurrences block time (special events are already injected above).
        const events = expandRecurringEvents(eventsWithSpecials, startDate, addDays(startDate, 14));

        // Everyone whose calendar must be free: the current user + selected users
        const blockingUserIds = [user.id, ...selectedUsers];

        const next14Days = Array.from({ length: 14 }, (_, i) => {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            return d;
        });

        return next14Days.map(day => {
            // 1. Get all blocking events for the relevant users on this day.
            // Only owners and *accepted* attendees block time (eventBlocksUser);
            // pending/declined attendees and viewers never block.
            const dayEvents = events.filter(e => {
                const eStart = new Date(e.start_time);
                const eEnd = new Date(e.end_time);

                // Check date overlap
                const overlapsDay = eStart < new Date(day.getTime() + 86400000) && eEnd > day;
                if (!overlapsDay) return false;

                // Injected special events (birthday/valentine) belong to the
                // current user's calendar, so they block their time.
                if (isSpecialEvent(e)) return true;

                return blockingUserIds.some(uid => eventBlocksUser(e, uid));
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
    }, [eventsWithSpecials, selectedUsers, user, startDate, loading]);

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

    // Handle Create Event from a free slot
    const handleCreateFromSlot = (slot: TimeSlot) => {
        // Prefill the create form. Dates/times are local wall clock (no UTC
        // conversion); CreateEvent consumes 'prefillEventData' when it mounts.
        localStorage.setItem('prefillEventData', JSON.stringify({
            date: format(slot.start, 'yyyy-MM-dd'),
            startTime: format(slot.start, 'HH:mm'),
            endTime: format(slot.end, 'HH:mm'),
            attendees: selectedUsers.filter(id => id !== user?.id) // Don't add self as attendee
        }));

        setIsModalOpen(false);

        if (isStandaloneRoute) {
            // Running as the /free-time-v2 route: Index mounts on '/' and
            // reads the ?tab query param to select its tab.
            navigate('/?tab=create');
        } else {
            // Running as an Index tab: ask Index to switch to its create tab.
            window.dispatchEvent(new CustomEvent('freecal:switch-tab', { detail: { tab: 'create' } }));
        }
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
                onBack={() => navigate('/')}
                rightAction={
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedUsers([])}>
                            Clear
                        </Button>
                    </div>
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
