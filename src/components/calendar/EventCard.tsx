import { CalendarEvent, getUserById, getUsersByIds } from '@/data/mockData';
import { formatTime } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import { Clock, Users, Repeat } from 'lucide-react';

interface EventCardProps {
  event: CalendarEvent;
  onClick?: () => void;
}

export function EventCard({ event, onClick }: EventCardProps) {
  const creator = getUserById(event.userId);
  const attendees = getUsersByIds(event.attendeeIds);

  const colorClasses = {
    self: 'bg-[hsl(var(--user-self)_/_0.15)] border-[hsl(var(--user-self))] text-foreground',
    partner1: 'bg-[hsl(var(--user-partner1)_/_0.15)] border-[hsl(var(--user-partner1))] text-foreground',
    partner2: 'bg-[hsl(var(--user-partner2)_/_0.15)] border-[hsl(var(--user-partner2))] text-foreground',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border-l-4 transition-all hover:scale-[1.02] active:scale-[0.98]',
        colorClasses[event.color]
      )}
      style={{ transition: 'var(--transition-smooth)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-sm leading-tight flex-1">{event.title}</h3>
        {event.recurrence && (
          <Repeat className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
        )}
      </div>

      <div className="space-y-1.5">
        {!event.isAllDay && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {formatTime(event.startDate)} - {formatTime(event.endDate)}
            </span>
          </div>
        )}

        {event.isAllDay && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>All day</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="font-medium">{creator?.name}</span>
          </div>
        </div>

        {attendees.length > 1 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{attendees.length} attendees</span>
          </div>
        )}

        {event.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
            {event.description}
          </p>
        )}
      </div>
    </button>
  );
}
