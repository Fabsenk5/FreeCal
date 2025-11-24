import { CalendarEvent, getUserById, getUsersByIds } from '@/data/mockData';
import { formatTime, formatDate } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import { Clock, Users, Repeat, Calendar, Eye } from 'lucide-react';

interface EventCardProps {
  event: CalendarEvent;
  onClick?: () => void;
}

export function EventCard({ event, onClick }: EventCardProps) {
  const creator = getUserById(event.userId);
  const attendees = getUsersByIds(event.attendeeIds);
  const viewers = getUsersByIds(event.viewerIds || []);

  // Check if event spans multiple days
  const startDate = new Date(event.startDate);
  const endDate = new Date(event.endDate);
  const isMultiDay = formatDate(event.startDate) !== formatDate(event.endDate);

  // Convert HSL color to rgba for background
  const getBackgroundColor = (color: string, isViewer?: boolean) => {
    // Extract HSL values from string like "hsl(217, 91%, 60%)"
    const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (hslMatch) {
      const [, h, s, l] = hslMatch;
      // Use 50% opacity (0.075) for viewer events, normal (0.15) for others
      const opacity = isViewer ? 0.075 : 0.15;
      return `hsla(${h}, ${s}%, ${l}%, ${opacity})`;
    }
    return color;
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border-l-4 transition-all hover:scale-[1.02] active:scale-[0.98] text-foreground'
      )}
      style={{
        backgroundColor: getBackgroundColor(event.color, event.isViewer),
        borderColor: event.color,
        transition: 'var(--transition-smooth)'
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-sm leading-tight flex-1">{event.title}</h3>
        {event.recurrence && (
          <Repeat className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
        )}
      </div>

      <div className="space-y-1.5">
        {/* Date display */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {isMultiDay
              ? `${formatDate(event.startDate)} - ${formatDate(event.endDate)}`
              : formatDate(event.startDate)}
          </span>
        </div>

        {/* Time display */}
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
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: event.color }}
            />
            <span className="font-medium">{event.creatorName || creator?.name || 'Unknown'}</span>
          </div>
        </div>

        {/* Attendees - Blue badges */}
        {attendees.length > 1 && (
          <div className="flex items-center gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-blue-400">{attendees.length} attendees</span>
          </div>
        )}

        {/* Viewers - Grey badges */}
        {viewers.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{viewers.length} viewers</span>
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