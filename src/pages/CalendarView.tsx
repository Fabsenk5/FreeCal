import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { MonthView } from '@/components/calendar/MonthView';
import { EventList } from '@/components/calendar/EventList';
import { ViewToggle, CalendarView as ViewType } from '@/components/calendar/ViewToggle';
import { MOCK_EVENTS, CalendarEvent } from '@/data/mockData';
import { getMonthName, isSameDay } from '@/utils/dateUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EventCard } from '@/components/calendar/EventCard';

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [view, setView] = useState<ViewType>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

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

  const getEventsForDate = (date: Date | null): CalendarEvent[] => {
    if (!date) return [];
    return MOCK_EVENTS.filter(event => isSameDay(new Date(event.startDate), date));
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

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
          events={MOCK_EVENTS}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />

        {/* Events for selected date */}
        {selectedDate && (
          <div className="mt-6">
            <EventList
              date={selectedDate}
              events={selectedDateEvents}
              onEventClick={setSelectedEvent}
            />
          </div>
        )}

        {/* Color legend */}
        <div className="mt-8 bg-card rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3">Event Colors</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[hsl(var(--user-self))]" />
              <span className="text-sm text-muted-foreground">Alex Morgan (You)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[hsl(var(--user-partner1))]" />
              <span className="text-sm text-muted-foreground">Jordan Taylor</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[hsl(var(--user-partner2))]" />
              <span className="text-sm text-muted-foreground">Casey Rivera</span>
            </div>
          </div>
        </div>
      </div>

      {/* Event details dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-[90%] rounded-xl">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <EventCard event={selectedEvent} />
              <div className="flex gap-2">
                <button className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium">
                  Edit
                </button>
                <button className="flex-1 px-4 py-2 bg-destructive text-destructive-foreground rounded-lg font-medium">
                  Delete
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
