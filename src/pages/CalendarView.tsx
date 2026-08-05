import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, CalendarPlus } from 'lucide-react';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { InviteInbox } from '@/components/notifications/InviteInbox';
import { MonthView } from '@/components/calendar/MonthView';
import { useEvents } from '@/hooks/useEvents';
import { useRelationships } from '@/hooks/useRelationships';
import { formatDate, getMonthName } from '@/utils/dateUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { EventCard } from '@/components/calendar/EventCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { deleteEvent, excludeOccurrence, EventWithAttendees } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ValentineCountdown } from '@/components/valentine/ValentineCountdown';
import { BirthdayCountdown } from '@/components/birthday/BirthdayCountdown';
import { useValentineEvent } from '@/hooks/useValentineEvent';
import { useBirthdayEvent } from '@/hooks/useBirthdayEvent';
import { expandRecurringEvents } from '@/utils/recurrence';
import { eventToICS, downloadICSFile, buildRRULE } from '@/utils/icsGenerator';
import {
  isNativeApp,
  pickNativeCalendar,
  writeNativeEvent,
  type NativeWriteEvent,
} from '@/lib/nativeBridge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EventComments } from '@/components/calendar/EventComments';
import { EventChecklist } from '@/components/calendar/EventChecklist';
import { CalendarEvent } from '@/data/mockData';
import { cn } from '@/lib/utils';

// Events flowing through this view may carry the special-event flag injected
// by useBirthdayEvent (not part of the shared EventWithAttendees type).
type ViewEvent = EventWithAttendees & { isBirthdayEvent?: boolean };
type MappedCalendarEvent = CalendarEvent & { isBirthdayEvent?: boolean };

/** RSVP status of the current user for events they attend (not own events). */
type MyAttendanceStatus = 'pending' | 'declined' | null;

/**
 * Resolve the current user's attendee status for an event. Returns null for
 * own events, non-attendees and events without attendee details (defensive:
 * missing details -> no visual marking).
 */
function getMyAttendanceStatus(event: EventWithAttendees, userId: string | undefined): MyAttendanceStatus {
  if (!userId || event.user_id === userId) return null;
  const detail = event.attendees_details?.find((a) => (a.userId ?? a.user_id) === userId);
  if (!detail) return null;
  return detail.status === 'pending' || detail.status === 'declined' ? detail.status : null;
}

/** travel_time is stored as text; only plain minute values are displayable. */
function parseTravelTime(travelTime: string | null): number | undefined {
  if (!travelTime) return undefined;
  const minutes = parseInt(travelTime, 10);
  return Number.isNaN(minutes) ? undefined : minutes;
}

/**
 * Map a FreeCal event to the native write payload. Recurring instances are
 * written as single events at their occurrence date (no RRULE), so the
 * exported event matches what the user sees.
 */
function toNativeWriteEvent(event: EventWithAttendees, isRecurringInstance: boolean): NativeWriteEvent {
  return {
    title: event.title || '(No title)',
    startDate: event.start_time,
    endDate: event.end_time,
    allDay: event.is_all_day,
    location: event.location || null,
    notes: event.description || null,
    url: event.url || null,
    alarmMinutes: (event.alerts || [])
      .map((a) => Number(a.minutes))
      .filter((m) => Number.isFinite(m) && m > 0),
    rrule: isRecurringInstance ? null : (buildRRULE(event) ?? null),
  };
}

/** Map a (possibly expanded recurring) event to the shape the view components expect. */
function toCalendarEvent(e: ViewEvent, myStatus: MyAttendanceStatus): MappedCalendarEvent {
  return {
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
    // Declined invitations are visually de-emphasized with a muted color.
    color: myStatus === 'declined' ? 'hsl(215, 16%, 47%)' : e.creator_color || 'hsl(217, 91%, 60%)',
    creatorName: e.creator_name,
    location: e.location || undefined,
    url: e.url || undefined,
    travelTime: parseTravelTime(e.travel_time),
    isTentative: e.is_tentative || false,
    recurrence: e.recurrence_type && e.recurrence_type !== 'none' ? {
      frequency: e.recurrence_type as 'daily' | 'weekly' | 'monthly' | 'custom',
      interval: e.recurrence_interval || undefined,
      endDate: e.recurrence_end_date ? new Date(e.recurrence_end_date) : undefined,
      daysOfWeek: e.recurrence_days?.map(d => parseInt(d)) || undefined,
    } : undefined,
    isValentineEvent: e.isValentineEvent,
    isBirthdayEvent: e.isBirthdayEvent,
  };
}

/** Multi-day aware date filter (date-only comparison, inclusive). */
function getEventsForDate<T extends { start_time: string; end_time: string }>(events: T[], date: Date | null): T[] {
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
}

export function CalendarView({
  onEditEvent,
  onSelectedDateChange,
  onQuickCreate,
  initialDate
}: {
  onEditEvent?: (event: EventWithAttendees) => void;
  onSelectedDateChange?: (date: Date | null) => void;
  onQuickCreate?: (date: Date) => void;
  initialDate?: Date | null;
}) {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(initialDate || new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(initialDate || new Date());

  // Update view when initialDate changes (e.g. returning from creating an event)
  useEffect(() => {
    if (initialDate) {
      setCurrentDate(initialDate);
      setSelectedDate(initialDate);
    }
  }, [initialDate]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // View range: visible month +/- 1 month (covers the spill-over weeks of the
  // month grid). Memoized so the React Query key stays stable across renders;
  // changing the month moves the range and triggers a new ranged fetch.
  const viewStart = useMemo(() => new Date(year, month - 1, 1), [year, month]);
  const viewEnd = useMemo(() => new Date(year, month + 2, 0, 23, 59, 59, 999), [year, month]);

  // P4: server-side range filter; recurring series are always included and
  // their occurrences inside the range are expanded client-side below.
  const { events: rawEvents, loading, refreshEvents } = useEvents({ rangeStart: viewStart, rangeEnd: viewEnd });
  const valentineEvents = useValentineEvent(rawEvents); // Inject Valentine event
  const birthdayEvents = useBirthdayEvent(valentineEvents); // Inject Birthday events

  // Expand recurring events over the same range (memoized — this is the
  // expensive transformation and must not re-run on unrelated re-renders).
  const events = useMemo(
    () => expandRecurringEvents(birthdayEvents, viewStart, viewEnd),
    [birthdayEvents, viewStart, viewEnd]
  );

  const { relationships, loading: relLoading } = useRelationships();
  const { profile } = useAuth();

  // RSVP status of the current user per event id (R19: pending/declined marking).
  const myAttendanceById = useMemo(() => {
    const map = new Map<string, 'pending' | 'declined'>();
    for (const e of events) {
      const status = getMyAttendanceStatus(e, profile?.id);
      if (status) map.set(e.id, status);
    }
    return map;
  }, [events, profile?.id]);

  const monthEvents = useMemo(
    () => events.map((e) => toCalendarEvent(e, myAttendanceById.get(e.id) ?? null)),
    [events, myAttendanceById]
  );

  const selectedDateEvents = useMemo(
    () => getEventsForDate(events, selectedDate),
    [events, selectedDate]
  );

  const sortedSelectedDateEvents = useMemo(
    () => [...selectedDateEvents].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    ),
    [selectedDateEvents]
  );

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    onSelectedDateChange?.(date); // Notify parent of date selection
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const selectedEventStatus: MyAttendanceStatus = selectedEvent
    ? myAttendanceById.get(selectedEvent.id) ?? null
    : null;

  // FIXED: Edit event handler with proper state passing
  const handleEditEvent = () => {
    if (!selectedEvent) return;

    console.log('CalendarView: Edit button clicked, event:', selectedEvent);

    if (onEditEvent) {
      // For recurring event instances, restore the original DB ID so the
      // edit form sends updates to the correct backend record.
      const eventForEdit = selectedEvent._originalEventId
        ? { ...selectedEvent, id: selectedEvent._originalEventId }
        : selectedEvent;
      onEditEvent(eventForEdit);
    } else {
      console.error('onEditEvent callback is not defined!');
    }

    // Close dialog
    setSelectedEventId(null);
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;

    // For recurring event instances, use the original DB ID for the API call
    const eventIdForApi = selectedEvent._originalEventId || selectedEvent.id;

    try {
      await deleteEvent(eventIdForApi);

      toast.success('Event deleted successfully!');
      setSelectedEventId(null);
      setShowDeleteDialog(false);
      refreshEvents();
    } catch (err) {
      console.error('Delete error:', err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Error: ${message}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
    }
  };

  const handleExcludeOccurrence = async () => {
    if (!selectedEvent || !selectedEvent._originalEventId) return;

    try {
      const occurrenceDate = new Date(selectedEvent.start_time).toISOString();
      await excludeOccurrence(selectedEvent._originalEventId, occurrenceDate);

      toast.success('Occurrence removed!');
      setSelectedEventId(null);
      setShowDeleteDialog(false);
      refreshEvents();
    } catch (err) {
      console.error('Exclude occurrence error:', err);
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Error: ${message}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
    }
  };

  // Share a single event with the iOS Calendar: Web Share API with the .ics
  // file on capable browsers (iOS 15+ opens "Add to Calendar"), download
  // fallback otherwise.
  const handleShareToiOS = async () => {
    if (!selectedEvent) return;

    // Recurring instances carry the original DB id in _originalEventId, so
    // the exported UID/RRULE refer to the actual stored event.
    const eventForExport = selectedEvent._originalEventId
      ? { ...selectedEvent, id: selectedEvent._originalEventId }
      : selectedEvent;

    // Inside the native iOS app: insert the event directly into a calendar
    // the user picks (native calendar picker + pre-filled confirm dialog).
    if (isNativeApp()) {
      try {
        const calendar = await pickNativeCalendar();
        if (!calendar) return;
        const result = await writeNativeEvent(
          calendar.id,
          toNativeWriteEvent(eventForExport, !!selectedEvent._originalEventId)
        );
        if (result.ok) {
          toast.success(`Added to iOS Calendar "${calendar.title}"`);
          return;
        }
        if (result.error === 'canceled') return;
        toast.error(result.error || 'Could not add the event to the iOS Calendar');
        return;
      } catch (err) {
        console.error('Native calendar write error:', err);
        toast.error('Could not add the event to the iOS Calendar');
        return;
      }
    }

    const ics = eventToICS(eventForExport);
    const safeTitle = (eventForExport.title || 'event')
      .replace(/[\W]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'event';
    const filename = `${safeTitle}.ics`;

    try {
      const file = new File([ics], filename, { type: 'text/calendar;charset=utf-8' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: eventForExport.title || 'Event' });
        return;
      }
    } catch (err) {
      // User dismissed the share sheet (AbortError) — fall through to download.
      console.warn('Web Share failed, falling back to download:', err);
    }

    downloadICSFile(ics, filename);
    toast.success('ICS file downloaded — open it on your iPhone to add the event to the iOS Calendar');
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
              onClick={() => navigate('/feature-wishlist')}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white border-0 text-xs h-7 px-2"
            >
              Wishlist
            </Button>
          </div>
        }
      />

      < div className="flex-1 overflow-y-auto pb-20 px-4" >
        {/* Valentine's Day Countdown */}
        <ValentineCountdown />

        {/* Birthday Countdown */}
        <BirthdayCountdown />

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
          events={monthEvents}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          onQuickCreate={onQuickCreate}
        />

        {/* Events for selected date */}
        {
          selectedDate && (
            <div className="mt-6">
              {sortedSelectedDateEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                    <span className="text-3xl">📅</span>
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No events</p>
                  <p className="text-xs text-muted-foreground text-center">
                    You have no events scheduled for {formatDate(selectedDate)}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold text-muted-foreground px-1 mb-3">
                    {formatDate(selectedDate)}
                  </h2>
                  {sortedSelectedDateEvents.map((e) => {
                    const status = myAttendanceById.get(e.id) ?? null;
                    return (
                      <div
                        key={e.id}
                        className={cn(
                          'relative',
                          status === 'pending' && 'opacity-70',
                          status === 'declined' && 'opacity-50'
                        )}
                      >
                        {status && (
                          <Badge
                            variant={status === 'pending' ? 'outline' : 'secondary'}
                            className="absolute top-2 right-2 z-10 px-1.5 py-0 text-[10px]"
                          >
                            {status === 'pending' ? 'Pending' : 'Declined'}
                          </Badge>
                        )}
                        <EventCard
                          event={toCalendarEvent(e, status)}
                          onClick={() => setSelectedEventId(e.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
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
              <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="checklist">Checklist</TabsTrigger>
                  <TabsTrigger value="comments">Comments</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="space-y-4">
                  {selectedEventStatus && (
                    <div className="flex items-center gap-2">
                      <Badge variant={selectedEventStatus === 'pending' ? 'outline' : 'secondary'}>
                        {selectedEventStatus === 'pending' ? 'Pending' : 'Declined'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {selectedEventStatus === 'pending'
                          ? 'You have not responded to this invitation yet.'
                          : 'You declined this invitation.'}
                      </span>
                    </div>
                  )}
                  <div className={cn(
                    selectedEventStatus === 'pending' && 'opacity-70',
                    selectedEventStatus === 'declined' && 'opacity-50'
                  )}>
                    <EventCard event={toCalendarEvent(selectedEvent, selectedEventStatus)} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={handleShareToiOS}
                    >
                      <CalendarPlus className="w-4 h-4 mr-2" />
                      Add to iOS Calendar
                    </Button>
                    {/* Allow editing/deleting own events */}
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
                          onClick={() => {
                            if (selectedEvent._originalEventId) {
                              // Recurring event instance — ask user
                              setShowDeleteDialog(true);
                            } else {
                              // Non-recurring — delete directly
                              handleDeleteEvent();
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="checklist">
                  <EventChecklist eventId={selectedEvent._originalEventId || selectedEvent.id} />
                </TabsContent>

                <TabsContent value="comments">
                  <EventComments eventId={selectedEvent._originalEventId || selectedEvent.id} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog >

      {/* Delete confirmation dialog for recurring events */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[90%] rounded-xl">
          <DialogHeader>
            <DialogTitle>Delete Recurring Event</DialogTitle>
            <DialogDescription>
              This event is part of a recurring series. What would you like to delete?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleExcludeOccurrence}
            >
              This occurrence only
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteEvent}
            >
              Entire series
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
}
