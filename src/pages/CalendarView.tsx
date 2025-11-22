import { useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { MonthView } from '@/components/calendar/MonthView';
import { EventList } from '@/components/calendar/EventList';
import { ViewToggle, CalendarView as ViewType } from '@/components/calendar/ViewToggle';
import { useEvents } from '@/hooks/useEvents';
import { useRelationships } from '@/hooks/useRelationships';
import { getMonthName, isSameDay } from '@/utils/dateUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EventCard } from '@/components/calendar/EventCard';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [view, setView] = useState<ViewType>('month');
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

  const getEventsForDate = (date: Date | null) => {
    if (!date) return [];
    return events.filter((event) => {
      const eventDate = new Date(event.start_time);
      return isSameDay(eventDate, date);
    });
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', selectedEvent.id);

      if (error) {
        toast.error(`Delete Error: ${error.message}`, {
          description: 'Copy this error and paste in chat for help',
          duration: 10000,
        });
        return;
      }

      toast.success('Event deleted successfully!');
      setSelectedEventId(null);
      refreshEvents();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
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
        title="Calendar"
        rightAction={<ViewToggle view={view} onViewChange={setView} />}
      />

      <div className="flex-1 overflow-y-auto pb-20 px-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between py-4">
          <h2 className="text-xl font-bold">
            {getMonthName(month)} {year}
          </h2>
          <div className="flex gap-1">
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
        </div>

        {/* Calendar */}
        <MonthView
          year={year}
          month={month}
          events={events.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description || '',
            startDate: new Date(e.start_time),
            endDate: new Date(e.end_time),
            isAllDay: e.is_all_day,
            userId: e.user_id,
            attendeeIds: e.attendees || [],
            color: 'self',
          }))}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />

        {/* Events for selected date */}
        {selectedDate && (
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
                color: 'self',
              }))}
              onEventClick={(event) => setSelectedEventId(event.id)}
            />
          </div>
        )}

        {/* Color legend */}
        <div className="mt-8 bg-card rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Event Colors</h3>
          <div className="space-y-2">
            {profile && (
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: profile.calendar_color }}
                />
                <span className="text-sm text-muted-foreground">
                  {profile.display_name} (You)
                </span>
              </div>
            )}
            {relationships.map((rel) => (
              <div key={rel.id} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: rel.profile.calendar_color }}
                />
                <span className="text-sm text-muted-foreground">
                  {rel.profile.display_name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Event details dialog */}
      <Dialog open={!!selectedEventId} onOpenChange={() => setSelectedEventId(null)}>
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
                  color: 'self',
                }}
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="destructive"
                  onClick={handleDeleteEvent}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
