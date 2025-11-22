import { cn } from '@/lib/utils';

export type CalendarView = 'month' | 'week' | 'day';

interface ViewToggleProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  const views: { value: CalendarView; label: string }[] = [
    { value: 'month', label: 'Month' },
    { value: 'week', label: 'Week' },
    { value: 'day', label: 'Day' },
  ];

  return (
    <div className="inline-flex bg-muted rounded-lg p-0.5">
      {views.map((v) => (
        <button
          key={v.value}
          onClick={() => onViewChange(v.value)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
            view === v.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
