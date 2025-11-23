import { useState } from 'react';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useEvents } from '@/hooks/useEvents';
import { useRelationships } from '@/hooks/useRelationships';
import { useAuth } from '@/contexts/AuthContext';
import { getCalendarDays, getMonthName, formatDate } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon, List, Loader2, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';

type ViewMode = 'calendar' | 'list';

interface FreeTimeSlot {
  date: Date;
  startTime: string;
  endTime: string;
  duration: number; // in minutes
  type: 'daytime' | 'overnight';
}

const TIMEZONES = [
  { value: 'UTC', label: 'UTC', offset: 0 },
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: -5 },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: -6 },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: -7 },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: -8 },
  { value: 'Europe/London', label: 'London (GMT)', offset: 0 },
  { value: 'Europe/Paris', label: 'Central European (CET)', offset: 1 },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: 4 },
  { value: 'Asia/Tokyo', label: 'Japan (JST)', offset: 9 },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)', offset: 11 },
  { value: 'Pacific/Auckland', label: 'New Zealand (NZDT)', offset: 13 },
];

export function FreeTimeFinder() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear] = useState(new Date().getFullYear());
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [timezone, setTimezone] = useState('UTC');
  const [dayRange, setDayRange] = useState<number[]>([1, 31]);

  const { events, loading: eventsLoading } = useEvents();
  const { relationships, loading: relLoading } = useRelationships();
  const { profile, user } = useAuth();

  const days = getCalendarDays(selectedYear, selectedMonth);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Get days in current month
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Check if a specific time slot is free for all selected users
  const isTimeSlotFree = (date: Date, startHour: number, endHour: number): boolean => {
    if (selectedUsers.length === 0) return false;

    const slotStart = new Date(date);
    slotStart.setHours(startHour, 0, 0, 0);
    
    const slotEnd = new Date(date);
    // Handle overnight slots
    if (endHour < startHour) {
      slotEnd.setDate(slotEnd.getDate() + 1);
    }
    slotEnd.setHours(endHour, 0, 0, 0);

    // Check if any selected user has events during this time slot
    const hasConflict = events.some((event) => {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);

      // Check if event creator or any attendee is in selected users
      const isUserInvolved =
        selectedUsers.includes(event.user_id) ||
        event.attendees?.some((attendeeId) => selectedUsers.includes(attendeeId));

      if (!isUserInvolved) return false;

      // Check for time overlap
      return eventStart < slotEnd && eventEnd > slotStart;
    });

    return !hasConflict;
  };

  // Generate free time slots with proper algorithm
  const generateFreeTimeSlots = (): FreeTimeSlot[] => {
    const slots: FreeTimeSlot[] = [];
    
    // Filter days based on day range
    const filteredDays = days.filter((date) => {
      if (!date) return false;
      const dayOfMonth = date.getDate();
      return dayOfMonth >= dayRange[0] && dayOfMonth <= dayRange[1];
    });

    filteredDays.forEach((date) => {
      if (!date) return;

      // Daytime slots: 9 AM - 5 PM (30-minute increments)
      for (let hour = 9; hour < 17; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const startHour = hour;
          const startMinute = minute;
          const endMinute = minute + 30;
          const endHour = endMinute >= 60 ? hour + 1 : hour;
          const adjustedEndMinute = endMinute >= 60 ? 0 : endMinute;

          if (endHour >= 17) break; // Don't go past 5 PM

          if (isTimeSlotFree(date, startHour, endHour > startHour ? endHour : startHour)) {
            const startTimeStr = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;
            const endTimeStr = `${endHour.toString().padStart(2, '0')}:${adjustedEndMinute.toString().padStart(2, '0')}`;

            slots.push({
              date: new Date(date),
              startTime: formatTime(startTimeStr),
              endTime: formatTime(endTimeStr),
              duration: 30,
              type: 'daytime',
            });
          }
        }
      }

      // Overnight suggestion: 10 PM - 6 AM (8 hours)
      if (isTimeSlotFree(date, 22, 6)) {
        slots.push({
          date: new Date(date),
          startTime: '10:00 PM',
          endTime: '6:00 AM',
          duration: 480,
          type: 'overnight',
        });
      }
    });

    return slots.slice(0, 50); // Limit to 50 slots for performance
  };

  const formatTime = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const isDateFree = (date: Date | null): boolean => {
    if (!date) return false;
    if (selectedUsers.length === 0) return false;

    // Check if within day range
    const dayOfMonth = date.getDate();
    if (dayOfMonth < dayRange[0] || dayOfMonth > dayRange[1]) return false;

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

  const freeTimeSlots = generateFreeTimeSlots();

  // Group slots by date for list view
  const groupedSlots = freeTimeSlots.reduce((acc, slot) => {
    const dateKey = slot.date.toISOString().split('T')[0];
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(slot);
    return acc;
  }, {} as Record<string, FreeTimeSlot[]>);

  const handleCreateFromSlot = (slot: FreeTimeSlot) => {
    toast.info('Creating event from free time slot');
    
    // Navigate to Create Event tab (you'll need to implement navigation)
    // For now, we'll use localStorage to pass the slot data
    localStorage.setItem('prefillEventData', JSON.stringify({
      date: slot.date.toISOString().split('T')[0],
      startTime: slot.startTime,
      endTime: slot.endTime,
      attendees: selectedUsers,
    }));

    // Trigger tab change or navigation
    window.dispatchEvent(new CustomEvent('navigateToCreateEvent'));
  };

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
              onValueChange={(value) => {
                setSelectedMonth(parseInt(value));
                // Reset day range when month changes
                const newDaysInMonth = new Date(selectedYear, parseInt(value) + 1, 0).getDate();
                setDayRange([1, newDaysInMonth]);
              }}
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

          {/* Timezone selector */}
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Day Range Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Day Range</Label>
              <span className="text-xs text-muted-foreground">
                {dayRange[1] - dayRange[0] + 1} days selected
              </span>
            </div>
            <Slider
              value={dayRange}
              onValueChange={setDayRange}
              min={1}
              max={daysInMonth}
              step={1}
              className="w-full"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Day {dayRange[0]}</span>
              <span>Day {dayRange[1]}</span>
            </div>
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

                  const dayOfMonth = date.getDate();
                  const isInRange = dayOfMonth >= dayRange[0] && dayOfMonth <= dayRange[1];
                  const isFree = isDateFree(date);
                  const isToday =
                    date.getDate() === new Date().getDate() &&
                    date.getMonth() === new Date().getMonth();

                  return (
                    <div
                      key={date.toISOString()}
                      className={cn(
                        'aspect-square rounded-lg p-1 flex items-center justify-center transition-all relative text-sm font-medium',
                        isFree && isInRange &&
                          'bg-[hsl(var(--free-time)_/_0.2)] text-[hsl(var(--free-time))]',
                        (!isFree || !isInRange) && 'text-muted-foreground',
                        !isInRange && 'opacity-30',
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
            <div className="space-y-4">
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
                Object.entries(groupedSlots).map(([dateKey, slots]) => (
                  <div key={dateKey} className="space-y-2">
                    {/* Date header - sticky */}
                    <div className="sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {formatDate(new Date(dateKey))}
                      </h3>
                    </div>
                    
                    {/* Slots for this date */}
                    <div className="space-y-2">
                      {slots.map((slot, index) => (
                        <div
                          key={index}
                          className={cn(
                            'bg-card rounded-lg p-4 hover:bg-accent transition-colors border-l-4',
                            slot.type === 'daytime' ? 'border-green-500' : 'border-blue-500'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              {/* Icon */}
                              <div className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                                slot.type === 'daytime' ? 'bg-green-500/10' : 'bg-blue-500/10'
                              )}>
                                {slot.type === 'daytime' ? (
                                  <Sun className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Moon className="w-4 h-4 text-blue-500" />
                                )}
                              </div>
                              
                              {/* Time info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold">
                                    {slot.startTime} - {slot.endTime}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    ({slot.duration} min)
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {slot.type === 'daytime' ? 'Daytime slot' : 'Overnight suggestion'}
                                </p>
                              </div>
                            </div>

                            {/* Create button */}
                            <Button
                              size="sm"
                              onClick={() => handleCreateFromSlot(slot)}
                              className="flex-shrink-0"
                            >
                              Create
                            </Button>
                          </div>
                        </div>
                      ))}
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
            Free Time Finder shows available time slots when all selected people are free. 
            Daytime slots are 30-minute increments from 9 AM to 5 PM. Overnight suggestions 
            are 8-hour blocks from 10 PM to 6 AM. Click "Create" to quickly schedule an event 
            during a free slot.
          </p>
        </div>
      </div>
    </div>
  );
}
