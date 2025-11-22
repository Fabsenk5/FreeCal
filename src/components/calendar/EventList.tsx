import { CalendarEvent } from '@/data/mockData';
import { EventCard } from './EventCard';
import { formatDate } from '@/utils/dateUtils';

interface EventListProps {
  date: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
}

export function EventList({ date, events, onEventClick }: EventListProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
          <span className="text-3xl">📅</span>
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No events</p>
        <p className="text-xs text-muted-foreground text-center">
          You have no events scheduled for {formatDate(date)}
        </p>
      </div>
    );
  }

  // Sort events by start time
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground px-1 mb-3">
        {formatDate(date)}
      </h2>
      {sortedEvents.map(event => (
        <EventCard
          key={event.id}
          event={event}
          onClick={() => onEventClick?.(event)}
        />
      ))}
    </div>
  );
}
