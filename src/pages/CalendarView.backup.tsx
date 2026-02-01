import { useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { InviteInbox } from '@/components/notifications/InviteInbox';
import { MonthView } from '@/components/calendar/MonthView';
import { EventList } from '@/components/calendar/EventList';
import { useEvents } from '@/hooks/useEvents';
import { useRelationships } from '@/hooks/useRelationships';
import { getMonthName } from '@/utils/dateUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EventCard } from '@/components/calendar/EventCard';
import { Button } from '@/components/ui/button';
import { api, EventWithAttendees } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export function CalendarView({ onEditEvent }: { onEditEvent?: (event: EventWithAttendees) => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const { events, loading, refreshEvents } = useEvents();
  const { relationships, loading: relLoading } = useRelationships();
  const { profile } = useAuth();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  // FIXED: Multi-day event filtering
  const getEventsForDate = (date: Date | null) => {
    if (!date) return [];

    return events.filter((event) => {
      const startDate = new Date(event.start_time);
      const endDate = new Date(event.end_time);

      // Set time to midnight for accurate date-only comparison
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);

      const eventStart = new Date(startDate);
      eventStart.setHours(0, 0, 0, 0);

      const eventEnd = new Date(endDate);
      eventEnd.setHours(0, 0, 0, 0);

      // Event is on this date if the date falls between start and end (inclusive)
      return checkDate >= eventStart && checkDate <= eventEnd;
    });
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  // FIXED: Edit event handler with proper state passing
  const handleEditEvent = () => {
    if (!selectedEvent) return;

    console.log('CalendarView: Edit button clicked, event:', selectedEvent);

    if (onEditEvent) {
      onEditEvent(selectedEvent);
    } else {
      console.error('onEditEvent callback is not defined!');
    }

    // Close dialog
    setSelectedEventId(null);
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    try {
      await api.delete(`/events/${selectedEvent.id}`);

      toast.success('Event deleted successfully!');
      setSelectedEventId(null);
      refreshEvents();
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(`Error: ${err.response?.data?.message || err.message}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
    }
  };

  if (loading || relLoading) {
    return (
      <div className="flex flex-col h-screen bg-background items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your calendar...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <MobileHeader
        title="FreeCal"
        rightAction={
          <div className="flex items-center gap-3">
            <InviteInbox />
            {/* Color legend - compact */}
            <div className="flex items-center gap-2">
              {profile && (
                <div className="flex items-center gap-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: profile.calendar_color }}
                  />
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {profile.display_name.split(' ')[0]}
                  </span>
                </div>
              )}
              {relationships.slice(0, 3).map((rel) => (
                <div key={rel.id} className="flex items-center gap-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: rel.profile.calendar_color }}
                  />
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {rel.profile.display_name.split(' ')[0]}
                  </span>
                </div>
              ))}

            </div>

            <Button
              variant="default"
              size="sm"
              onClick={() => window.location.href = '/feature-wishlist'}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0 text-xs h-7 px-2"
            >
              Wishlist
            </Button>
          </div>
        }
      />

      < div className="flex-1 overflow-y-auto pb-20 px-4" >
        {/* Month/Year navigation with dropdowns */}
        < div className="flex items-center justify-between py-4 gap-4" >
          <div className="flex items-center gap-2 flex-1">
            {/* Month Selector */}
            <Select
              value={month.toString()}
              onValueChange={(value) => {
                const newMonth = parseInt(value);
                setCurrentDate(new Date(year, newMonth, 1));
              }}
            >
              <SelectTrigger className="w-[140px] bg-card">
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

            {/* Year Selector */}
            <Select
              value={year.toString()}
              onValueChange={(value) => {
                const newYear = parseInt(value);
                setCurrentDate(new Date(newYear, month, 1));
              }}
            >
              <SelectTrigger className="w-[100px] bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-1 shrink-0">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div >

        {/* Calendar */}
        < MonthView
          year={year}
          month={month}
          events={
            events.map((e) => ({
              id: e.id,
              title: e.title,
              description: e.description || '',
              startDate: new Date(e.start_time),
              endDate: new Date(e.end_time),
              isAllDay: e.is_all_day,
              userId: e.user_id,
              attendeeIds: e.attendees || [],
              viewerIds: e.viewers || [],
              isViewer: e.isViewer,
              color: e.creator_color || 'hsl(217, 91%, 60%)',
              creatorName: e.creator_name,
              location: e.location || undefined,
              url: e.url || undefined,
              isTentative: e.is_tentative || false,
              recurrence: e.recurrence_type && e.recurrence_type !== 'none' ? {
                frequency: e.recurrence_type as 'daily' | 'weekly' | 'monthly' | 'custom',
                interval: e.recurrence_interval || undefined,
                endDate: e.recurrence_end_date ? new Date(e.recurrence_end_date) : undefined,
                daysOfWeek: e.recurrence_days?.map(d => parseInt(d)) || undefined,
              } : undefined,
            }))
          }
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />

        {/* Events for selected date */}
        {
          selectedDate && (
            <div className="mt-6">
              <EventList
                date={selectedDate}
                events={selectedDateEvents.map((e) => ({
                  id: e.id,
                  title: e.title,
                  description: e.description || '',
                  startDate: new Date(e.start_time),
                  endDate: new Date(e.end_time),
                  isAllDay: e.is_all_day,
                  userId: e.user_id,
                  attendeeIds: e.attendees || [],
                  viewerIds: e.viewers || [],
                  isViewer: e.isViewer,
                  color: e.creator_color || 'hsl(217, 91%, 60%)',
                  creatorName: e.creator_name,
                  location: e.location || undefined,
                  url: e.url || undefined,
                  isTentative: e.is_tentative || false,
                  recurrence: e.recurrence_type && e.recurrence_type !== 'none' ? {
                    frequency: e.recurrence_type as 'daily' | 'weekly' | 'monthly' | 'custom',
                    interval: e.recurrence_interval || undefined,
                    endDate: e.recurrence_end_date ? new Date(e.recurrence_end_date) : undefined,
                    daysOfWeek: e.recurrence_days?.map(d => parseInt(d)) || undefined,
                  } : undefined,
                }))}
                onEventClick={(event) => setSelectedEventId(event.id)}
              />
            </div>
          )
        }
      </div >

      {/* Event details dialog */}
      < Dialog open={!!selectedEventId} onOpenChange={() => setSelectedEventId(null)}>
        <DialogContent className="max-w-[90%] rounded-xl">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <EventCard
                event={{
                  id: selectedEvent.id,
                  title: selectedEvent.title,
                  description: selectedEvent.description || '',
                  startDate: new Date(selectedEvent.start_time),
                  endDate: new Date(selectedEvent.end_time),
                  isAllDay: selectedEvent.is_all_day,
                  userId: selectedEvent.user_id,
                  attendeeIds: selectedEvent.attendees || [],
                  viewerIds: selectedEvent.viewers || [],
                  isViewer: selectedEvent.isViewer,
                  color: selectedEvent.creator_color || 'hsl(217, 91%, 60%)',
                  creatorName: selectedEvent.creator_name,
                  location: selectedEvent.location || undefined,
                  url: selectedEvent.url || undefined,
                  isTentative: selectedEvent.is_tentative || false,
                  recurrence: selectedEvent.recurrence_type && selectedEvent.recurrence_type !== 'none' ? {
                    frequency: selectedEvent.recurrence_type as 'daily' | 'weekly' | 'monthly' | 'custom',
                    interval: selectedEvent.recurrence_interval || undefined,
                    endDate: selectedEvent.recurrence_end_date ? new Date(selectedEvent.recurrence_end_date) : undefined,
                    daysOfWeek: selectedEvent.recurrence_days?.map(d => parseInt(d)) || undefined,
                  } : undefined,
                }}
              />
              <div className="flex gap-2">
                {/* Only allow editing/deleting own events */}
                {profile && selectedEvent.user_id === profile.id && (
                  <>
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={handleEditEvent}
                    >
                      Edit
                    </Button>
                    <Button
                      className="flex-1"
                      variant="destructive"
                      onClick={handleDeleteEvent}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog >
    </div >
  );
}