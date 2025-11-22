import { useState } from 'react';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useEvents } from '@/hooks/useEvents';
import { useRelationships } from '@/hooks/useRelationships';
import { useAuth } from '@/contexts/AuthContext';
import { getCalendarDays, getMonthName, formatDate } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon, List, Loader2 } from 'lucide-react';

type ViewMode = 'calendar' | 'list';

interface FreeTimeSlot {
  date: Date;
  startTime: string;
  endTime: string;
}

export function FreeTimeFinder() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const { events, loading: eventsLoading } = useEvents();
  const { relationships, loading: relLoading } = useRelationships();
  const { profile, user } = useAuth();

  const days = getCalendarDays(selectedYear, selectedMonth);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const isDateFree = (date: Date | null): boolean => {
    if (!date) return false;
    if (selectedUsers.length === 0) return false;

    // Check if any selected user has events on this date
    const dateEvents = events.filter((event) => {
      const eventDate = new Date(event.start_time);
      const isSameDate =
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear();

      // Check if event creator or any attendee is in selected users
      const isUserInvolved =
        selectedUsers.includes(event.user_id) ||
        event.attendees?.some((attendeeId) => selectedUsers.includes(attendeeId));

      return isSameDate && isUserInvolved;
    });

    return dateEvents.length === 0;
  };

  // Generate free time slots
  const freeTimeSlots: FreeTimeSlot[] = days
    .filter((date) => date && isDateFree(date))
    .slice(0, 20)
    .map((date) => ({
      date: date!,
      startTime: '9:00 AM',
      endTime: '5:00 PM',
    }));

  if (eventsLoading || relLoading) {
    return (
      <div className="flex flex-col h-screen bg-background items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <MobileHeader
        title="Free Time Finder"
        rightAction={
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                'p-2 rounded-md transition-all',
                viewMode === 'calendar'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-2 rounded-md transition-all',
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto pb-20 px-4">
        {/* Filters */}
        <div className="space-y-4 py-4">
          {/* Month selector */}
          <div className="space-y-2">
            <Label>Month</Label>
            <Select
              value={selectedMonth.toString()}
              onValueChange={(value) => setSelectedMonth(parseInt(value))}
            >
              <SelectTrigger className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    {getMonthName(i)} {selectedYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* User selection */}
          <div className="space-y-2">
            <Label>Check availability for</Label>
            <div className="space-y-2">
              {/* Current user */}
              {profile && user && (
                <button
                  type="button"
                  onClick={() => toggleUser(user.id)}
                  className="w-full flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent transition-colors"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: profile.calendar_color }}
                  />
                  <span className="flex-1 text-left text-sm">
                    {profile.display_name} (You)
                  </span>
                  {selectedUsers.includes(user.id) && (
                    <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                      ✓
                    </div>
                  )}
                </button>
              )}

              {/* Relationships */}
              {relationships.map((rel) => (
                <button
                  key={rel.id}
                  type="button"
                  onClick={() => toggleUser(rel.profile.id)}
                  className="w-full flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent transition-colors"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: rel.profile.calendar_color }}
                  />
                  <span className="flex-1 text-left text-sm">
                    {rel.profile.display_name}
                  </span>
                  {selectedUsers.includes(rel.profile.id) && (
                    <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                      ✓
                    </div>
                  )}
                </button>
              ))}

              {relationships.length === 0 && !profile && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No relationships yet. Add connections in your profile.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Available Time</h2>
            <span className="text-xs text-muted-foreground">
              {freeTimeSlots.length} slots found
            </span>
          </div>

          {viewMode === 'calendar' ? (
            <div className="bg-card rounded-xl p-4 shadow-sm">
              {/* Week day headers */}
              <div className="grid grid-cols-7 gap-1 mb-3">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {days.map((date, index) => {
                  if (!date) {
                    return <div key={`empty-${index}`} className="aspect-square" />;
                  }

                  const isFree = isDateFree(date);
                  const isToday =
                    date.getDate() === new Date().getDate() &&
                    date.getMonth() === new Date().getMonth();

                  return (
                    <div
                      key={date.toISOString()}
                      className={cn(
                        'aspect-square rounded-lg p-1 flex items-center justify-center transition-all relative text-sm font-medium',
                        isFree &&
                          'bg-[hsl(var(--free-time)_/_0.2)] text-[hsl(var(--free-time))]',
                        !isFree && 'text-muted-foreground',
                        isToday && 'border-2 border-primary'
                      )}
                    >
                      {date.getDate()}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[hsl(var(--free-time)_/_0.2)]" />
                  <span className="text-xs text-muted-foreground">Available</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {freeTimeSlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                    <span className="text-3xl">🗓️</span>
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    No free time found
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    {selectedUsers.length === 0
                      ? 'Select users to check availability'
                      : 'Try selecting different users or a different month'}
                  </p>
                </div>
              ) : (
                freeTimeSlots.map((slot, index) => (
                  <div
                    key={index}
                    className="bg-card border-l-4 border-[hsl(var(--free-time))] rounded-lg p-4 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm mb-1">
                          {formatDate(slot.date)}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {slot.startTime} - {slot.endTime}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Info card */}
        <div className="mt-6 bg-muted/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-2">💡 How it works</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Free Time Finder shows you available time slots when all selected people are
            free. Select multiple people to find overlapping availability for meetings or
            events.
          </p>
        </div>
      </div>
    </div>
  );
}
