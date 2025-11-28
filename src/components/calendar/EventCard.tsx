import { CalendarEvent, getUserById, getUsersByIds } from '@/data/mockData';
import { formatTime, formatDate } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import { Clock, Users, Repeat, Calendar, Eye, MapPin, Link } from 'lucide-react';

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

  // Format recurrence info in lean text
  const getRecurrenceText = () => {
    if (!event.recurrence) return null;
    
    const { frequency, endDate, daysOfWeek } = event.recurrence;
    
    let freqText = frequency.charAt(0).toUpperCase() + frequency.slice(1);
    if (daysOfWeek && daysOfWeek.length > 0) {
      const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      freqText = daysOfWeek.map(d => days[d]).join(', ');
    }
    
    if (endDate) {
      return `${freqText} until ${formatDate(endDate)}`;
    }
    
    return freqText;
  };

  // Get first line of description
  const firstLineDescription = event.description?.split('\n')[0];

  // Determine user's status for this event
  const getUserStatus = () => {
    if (event.isViewer) {
      return { icon: Eye, text: 'Viewing', color: 'text-muted-foreground' };
    }
    if (attendees.length > 1) {
      return { icon: Users, text: 'Attending', color: 'text-blue-400' };
    }
    return null;
  };

  const userStatus = getUserStatus();

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
      {/* Event Title */}
      <h3 className="font-semibold text-sm leading-tight mb-2">{event.title}</h3>

      <div className="space-y-1">
        {/* Line 1: Date (with icon) + Time (with icon) + Tentative status */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            {isMultiDay
              ? `${formatDate(event.startDate)} - ${formatDate(event.endDate)}`
              : formatDate(event.startDate)}
          </span>
          
          {!event.isAllDay && (
            <>
              <Clock className="w-3.5 h-3.5 flex-shrink-0 ml-1" />
              <span>
                {formatTime(event.startDate)} - {formatTime(event.endDate)}
              </span>
            </>
          )}
          {event.isAllDay && (
            <>
              <Clock className="w-3.5 h-3.5 flex-shrink-0 ml-1" />
              <span>All day</span>
            </>
          )}
          
          {event.isTentative && (
            <>
              <span className="ml-1">•</span>
              <span className="text-amber-500 italic">Tentative</span>
            </>
          )}
        </div>

        {/* Line 2: Attendee/Viewer status + Location + Creator */}
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          {userStatus && (
            <>
              <div className={cn("flex items-center gap-1", userStatus.color)}>
                <userStatus.icon className="w-3.5 h-3.5" />
                <span>{userStatus.text}</span>
              </div>
              <span className="text-muted-foreground">•</span>
            </>
          )}
          
          {event.location && (
            <>
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                <span className="truncate max-w-[120px]">{event.location}</span>
              </div>
              <span className="text-muted-foreground">•</span>
            </>
          )}
          
          <div className="flex items-center gap-1 text-muted-foreground">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: event.color }}
            />
            <span>{event.creatorName || creator?.name || 'Unknown'}</span>
          </div>
        </div>

        {/* Line 3: Recurring info (icon + details) + URL + First line of description/note */}
        {(event.recurrence || event.url || firstLineDescription) && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground flex-wrap">
            {event.recurrence && (
              <>
                <Repeat className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="flex-shrink-0">{getRecurrenceText()}</span>
              </>
            )}
            
            {event.recurrence && (event.url || firstLineDescription) && (
              <span>•</span>
            )}
            
            {event.url && (
              <>
                <Link className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="truncate max-w-[150px]">{event.url}</span>
              </>
            )}
            
            {event.url && firstLineDescription && (
              <span>•</span>
            )}
            
            {firstLineDescription && (
              <span className="line-clamp-1 flex-1">{firstLineDescription}</span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
