import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Search, CalendarPlus } from 'lucide-react';
import { toast } from 'sonner';
import type { ParsedEvent } from '@/utils/icsParser';
import {
  getNativeCalendars,
  getNativeEvents,
  type NativeCalendar,
  type NativeCalendarEvent,
} from '@/lib/nativeBridge';
import { nativeEventToParsedEvent } from '@/utils/nativeEventMapper';

interface NativeCalendarImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (parsed: ParsedEvent) => void;
}

/** 'YYYY-MM-DD' from the LOCAL date part (input[type=date] format). */
function formatDateForInput(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().split('T')[0];
}

function formatEventDate(ev: NativeCalendarEvent): string {
  const start = new Date(ev.startDate);
  const base = start.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
  if (ev.allDay) return `${base} · All day`;
  return `${base} · ${start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

export function NativeCalendarImport({
  open,
  onOpenChange,
  onImport,
}: NativeCalendarImportProps) {
  const [calendars, setCalendars] = useState<NativeCalendar[]>([]);
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([]);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(() => formatDateForInput(new Date()));
  const [endDate, setEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 31);
    return formatDateForInput(d);
  });
  const [events, setEvents] = useState<NativeCalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEvents([]);
    setEventsError(null);
    setSelectedEventId(null);
    setCalendarError(null);
    getNativeCalendars()
      .then((cals) => {
        setCalendars(cals);
        setSelectedCalendars(cals.map((c) => c.id));
      })
      .catch((err: Error) => {
        setCalendarError(err.message || 'Calendar access failed');
      });
  }, [open]);

  const toggleCalendar = (id: string) => {
    setSelectedCalendars((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleLoadEvents = async () => {
    if (selectedCalendars.length === 0) {
      toast.error('Select at least one calendar');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('Pick a date range');
      return;
    }
    setEventsLoading(true);
    setEventsError(null);
    try {
      const rangeStart = new Date(`${startDate}T00:00:00`);
      const rangeEnd = new Date(`${endDate}T23:59:59`);
      const data = await getNativeEvents(rangeStart, rangeEnd, selectedCalendars);
      setEvents(data);
      setSelectedEventId(data[0]?.id ?? null);
      if (data.length === 0) {
        toast.info('No events found in this range');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setEventsError(message);
    } finally {
      setEventsLoading(false);
    }
  };

  const handleImport = () => {
    const ev = events.find((e) => e.id === selectedEventId);
    if (!ev) return;
    onImport(nativeEventToParsedEvent(ev));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90%] rounded-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from iOS Calendar</DialogTitle>
          <DialogDescription>
            Pick calendars and a date range, then select the event you want to import. Repeating
            events keep their recurrence rules.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {calendarError ? (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {calendarError}. Please allow calendar access in iOS Settings and reopen this dialog.
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Calendars</Label>
                {calendars.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No calendars found.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto">
                    {calendars.map((cal) => (
                      <label
                        key={cal.id}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                          selectedCalendars.includes(cal.id) ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={selectedCalendars.includes(cal.id)}
                          onChange={() => toggleCalendar(cal.id)}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium truncate">{cal.title}</span>
                          {cal.source && (
                            <span className="block text-xs text-muted-foreground truncate">{cal.source}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="native-start">From</Label>
                  <Input
                    id="native-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="native-end">To</Label>
                  <Input
                    id="native-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <Button className="w-full" onClick={handleLoadEvents} disabled={eventsLoading}>
                {eventsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Load Events
              </Button>

              {eventsError && (
                <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  {eventsError}
                </div>
              )}

              {events.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Events ({events.length})</Label>
                  <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                    {events.map((ev) => (
                      <label
                        key={ev.id}
                        className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer text-sm ${
                          selectedEventId === ev.id ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                      >
                        <input
                          type="radio"
                          name="native-event-pick"
                          className="mt-0.5 accent-primary"
                          checked={selectedEventId === ev.id}
                          onChange={() => setSelectedEventId(ev.id)}
                        />
                        <span className="min-w-0">
                          <span className="block font-medium truncate">{ev.title || '(Untitled event)'}</span>
                          <span className="block text-xs text-muted-foreground">{formatEventDate(ev)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <Button className="w-full" onClick={handleImport} disabled={!selectedEventId}>
                    <CalendarPlus className="w-4 h-4 mr-2" />
                    Import Selected Event
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
