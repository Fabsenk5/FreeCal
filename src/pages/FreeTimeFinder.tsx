/**
 * BACKUP - Working version before UI improvements
 * Date: 2025-11-24
 * To restore: Copy this file back to FreeTimeFinder.tsx
 */

import { useState } from 'react';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { DualTimeSlider, TimeFrameValue } from '@/components/ui/dual-time-slider';
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

export function FreeTimeFinder() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [timeFrame, setTimeFrame] = useState<TimeFrameValue>({
    startMinutes: 540,  // Day 1 09:00
    endMinutes: 1020,   // Day 1 17:00
  });
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

  // Convert slider minutes (0-2879) to actual day and time
  const getTimeFromMinutes = (totalMinutes: number) => {
    const day = Math.floor(totalMinutes / (24 * 60)); // 0 for Day 1, 1 for Day 2
    const minutesInDay = totalMinutes % (24 * 60);
    const hours = Math.floor(minutesInDay / 60);
    const minutes = minutesInDay % 60;
    return { day, hours, minutes };
  };

  // Check if a time is within the selected time frame
  const isTimeInFrame = (date: Date, hour: number, minute: number): boolean => {
    const timeMinutes = hour * 60 + minute;

    const startTime = getTimeFromMinutes(timeFrame.startMinutes);
    const endTime = getTimeFromMinutes(timeFrame.endMinutes);

    // Determine which day this date represents in our 2-day frame
    // We'll check both Day 1 and Day 2 scenarios

    // Day 1 check
    if (startTime.day === 0) {
      const startMinutesDay1 = startTime.hours * 60 + startTime.minutes;
      if (timeMinutes >= startMinutesDay1 && timeMinutes < 24 * 60) {
        return true;
      }
    }

    // Day 2 check
    if (endTime.day === 1) {
      const endMinutesDay2 = endTime.hours * 60 + endTime.minutes;
      if (timeMinutes <= endMinutesDay2) {
        return true;
      }
    }

    // If the entire frame is on Day 1
    if (startTime.day === 0 && endTime.day === 0) {
      const startMinutesDay1 = startTime.hours * 60 + startTime.minutes;
      const endMinutesDay1 = endTime.hours * 60 + endTime.minutes;
      return timeMinutes >= startMinutesDay1 && timeMinutes <= endMinutesDay1;
    }

    return false;
  };

  // Check if a specific time slot is free for all selected users
  const isTimeSlotFree = (date: Date, startHour: number, endHour: number): boolean => {
    if (selectedUsers.length === 0) return false;

    // Check if time slot is within selected time frame
    if (!isTimeInFrame(date, startHour, 0)) return false;

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

      // Generate slots in 30-minute increments within the selected time frame
      let currentMinutes = timeFrame.startMinutes;
      const maxMinutes = timeFrame.endMinutes;

      while (currentMinutes < maxMinutes) {
        const nextMinutes = Math.min(currentMinutes + 30, maxMinutes);

        const currentTime = getTimeFromMinutes(currentMinutes);
        const nextTime = getTimeFromMinutes(nextMinutes);

        // Determine which date to use for this slot
        let slotDate = new Date(date);

        // If both times are on Day 2, use next day
        if (currentTime.day === 1 && nextTime.day === 1) {
          slotDate.setDate(slotDate.getDate() + 1);
        }

        // If transitioning from Day 1 to Day 2, use current day (will check into next day)
        // This is handled automatically by isTimeSlotFree when endHour < startHour

        if (isTimeSlotFree(slotDate, currentTime.hours, nextTime.hours)) {
          const startTimeStr = `${currentTime.hours.toString().padStart(2, '0')}:${currentTime.minutes
            .toString()
            .padStart(2, '0')}`;
          const endTimeStr = `${nextTime.hours.toString().padStart(2, '0')}:${nextTime.minutes
            .toString()
            .padStart(2, '0')}`;

          const isOvernight = nextTime.hours < currentTime.hours || (currentTime.hours >= 20 || nextTime.hours <= 6);

          slots.push({
            date: new Date(slotDate),
            startTime: formatTime(startTimeStr),
            endTime: formatTime(endTimeStr),
            duration: 30,
            type: isOvernight ? 'overnight' : 'daytime',
          });
        }

        currentMinutes = nextMinutes;

        // Safety check to prevent infinite loops
        if (slots.length > 200) break;
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
    localStorage.setItem(
      'prefillEventData',
      JSON.stringify({
        date: slot.date.toISOString().split('T')[0],
        startTime: slot.startTime,
        endTime: slot.endTime,
        attendees: selectedUsers,
      })
    );

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

  // Calculate if time frame spans into Day 2
  const startTime = getTimeFromMinutes(timeFrame.startMinutes);
  const endTime = getTimeFromMinutes(timeFrame.endMinutes);
  const spansIntoDay2 = endTime.day === 1;

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
          {/* Year selector */}
          <div className="space-y-2">
            <Label>Year</Label>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => {
                setSelectedYear(parseInt(value));
                // Reset day range when year changes
                const newDaysInMonth = new Date(parseInt(value), selectedMonth + 1, 0).getDate();
                setDayRange([1, newDaysInMonth]);
              }}
            >
              <SelectTrigger className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
                    {getMonthName(i)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Frame Selection - NEW DUAL SLIDER */}
          <div className="space-y-2">
            <DualTimeSlider
              value={timeFrame}
              onChange={setTimeFrame}
              step={15}
            />
            <p className="text-xs text-muted-foreground">
              {spansIntoDay2 ? 'Spans into Day 2' : 'Day 1 time frame only'}
            </p>
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
                              <div
                                className={cn(
                                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                                  slot.type === 'daytime'
                                    ? 'bg-green-500/10'
                                    : 'bg-blue-500/10'
                                )}
                              >
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
                                  {slot.type === 'daytime'
                                    ? 'Daytime slot'
                                    : 'Overnight suggestion'}
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
            Free Time Finder shows available time slots when all selected people are free within 
            your chosen time frame. Select a start and end time (can span up to 48 hours, including 
            overnight). Use the day range slider to filter specific dates within the month. 
            Available slots are shown in 30-minute increments. Click "Create" to quickly schedule 
            an event during a free slot.
          </p>
        </div>
      </div>
    </div>
  );
}