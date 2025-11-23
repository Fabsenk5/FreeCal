import { CalendarEvent } from '@/data/mockData';
import { getCalendarDays, getWeekDays, isSameDay, isToday } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';

interface MonthViewProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
}

export function MonthView({ year, month, events, selectedDate, onDateSelect }: MonthViewProps) {
  const days = getCalendarDays(year, month);
  const weekDays = getWeekDays();

  const getEventsForDate = (date: Date | null): CalendarEvent[] => {
    if (!date) return [];
    // Include events that start on this date OR span across this date
    return events.filter(event => {
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);
      
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

  return (
    <div className="bg-card rounded-xl p-4 shadow-sm">
      {/* Week day headers */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
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

          const dayEvents = getEventsForDate(date);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isCurrentDay = isToday(date);

          return (
            <button
              key={date.toISOString()}
              onClick={() => onDateSelect(date)}
              className={cn(
                'aspect-square rounded-lg p-1 flex flex-col items-center justify-start transition-all relative',
                'hover:bg-accent',
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
                isCurrentDay && !isSelected && 'border-2 border-primary'
              )}
            >
              <span className={cn(
                'text-sm font-medium mb-0.5',
                isSelected && 'text-primary-foreground',
                !isSelected && isCurrentDay && 'text-primary font-bold'
              )}>
                {date.getDate()}
              </span>
              
              {/* Event indicators */}
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 flex-wrap justify-center">
                  {dayEvents.slice(0, 3).map((event, i) => (
                    <div
                      key={event.id}
                      className={cn(
                        'w-1 h-1 rounded-full',
                        event.color === 'self' && 'bg-[hsl(var(--user-self))]',
                        event.color === 'partner1' && 'bg-[hsl(var(--user-partner1))]',
                        event.color === 'partner2' && 'bg-[hsl(var(--user-partner2))]',
                        isSelected && 'bg-primary-foreground'
                      )}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className={cn('text-[8px]', isSelected ? 'text-primary-foreground' : 'text-muted-foreground')}>
                      +{dayEvents.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}