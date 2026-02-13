import React, { useState, useEffect, useRef } from 'react';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRelationships } from '@/hooks/useRelationships';
import { useEvents } from '@/hooks/useEvents';
import { Calendar, Upload, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { api, EventWithAttendees } from '@/lib/api';
import { parseICS, ParsedEvent } from '@/utils/icsParser';
import { ImportMethodDialog } from '@/components/calendar/ImportMethodDialog';
import { ScreenshotImportDialog } from '@/components/calendar/ScreenshotImportDialog';
import { OCREventData } from '@/utils/calendarOCR';

interface CreateEventProps {
  eventToEdit?: EventWithAttendees | null;
  onEventSaved?: (savedEvent?: { start_time: string }) => void;
  initialDate?: Date | null; // NEW: Pre-fill date from calendar selection
}

export function CreateEvent({ eventToEdit, onEventSaved, initialDate }: CreateEventProps) {
  const { user, profile } = useAuth();
  const { relationships, loading: relLoading } = useRelationships();
  const { events } = useEvents();

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventColor, setEventColor] = useState<string>(profile?.calendar_color || 'hsl(217, 91%, 60%)');
  const [notes, setNotes] = useState<string>('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [viewers, setViewers] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly' | 'custom' | 'none'>('none');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>([]);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<string>('');
  const [eventUrl, setEventUrl] = useState<string>('');
  const [isTentative, setIsTentative] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);
  const icsFileInputRef = useRef<HTMLInputElement>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showScreenshotDialog, setShowScreenshotDialog] = useState(false);
  const [sharingStatus, setSharingStatus] = useState<Record<string, 'attendee' | 'viewer' | 'none'>>({});
  const [attendeeStatuses, setAttendeeStatuses] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflictingEvents, setConflictingEvents] = useState<EventWithAttendees[]>([]);

  // Convert 12-hour time format to 24-hour
  const convertTo24Hour = (time12: string): string => {
    const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return '';

    let hours = parseInt(match[1]);
    const minutes = match[2];
    const period = match[3].toUpperCase();

    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  };

  // Helper: Format date for input type="date" (YYYY-MM-DD) using LOCAL time
  const formatDateForInput = (date: Date): string => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  // Helper: Suggest appropriate start time based on current time
  const suggestStartTime = (now: Date): string => {
    const hour = now.getHours();
    const minutes = now.getMinutes();

    // Round up to next hour or half-hour
    let suggestedHour = hour;
    let suggestedMin = 0;

    if (minutes > 45) {
      suggestedHour = hour + 1;
    } else if (minutes > 15) {
      suggestedMin = 30;
    }

    // Cap at 23:30 to avoid overflow
    if (suggestedHour >= 24) {
      suggestedHour = 23;
      suggestedMin = 30;
    }

    return `${String(suggestedHour).padStart(2, '0')}:${String(suggestedMin).padStart(2, '0')}`;
  };

  // Helper: Add hours to time string (HH:MM format)
  const addHours = (timeStr: string, hours: number): string => {
    const [h, m] = timeStr.split(':').map(Number);
    const newHour = (h + hours) % 24;
    return `${String(newHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // FIXED: Load event data from prop when editing
  useEffect(() => {
    if (eventToEdit) {
      console.log('CreateEvent: Loading event to edit:', eventToEdit);

      setEditingEventId(eventToEdit.id);
      setTitle(eventToEdit.title);

      const start = new Date(eventToEdit.start_time);
      const end = new Date(eventToEdit.end_time);

      setStartDate(start.toISOString().split('T')[0]);
      setStartTime(start.toTimeString().slice(0, 5));
      setEndDate(end.toISOString().split('T')[0]);
      setEndTime(end.toTimeString().slice(0, 5));
      setIsAllDay(eventToEdit.is_all_day);
      setRecurrenceType(eventToEdit.recurrence_type);
      setRecurrenceDays(eventToEdit.recurrence_days || []);
      setRecurrenceInterval(eventToEdit.recurrence_interval || 1);
      setRecurrenceEndDate(eventToEdit.recurrence_end_date ? eventToEdit.recurrence_end_date.split('T')[0] : '');
      setAttendees(eventToEdit.attendees || []);
      setViewers(eventToEdit.viewers || []);

      // Build unified sharing status from attendees and viewers
      const status: Record<string, 'attendee' | 'viewer' | 'none'> = {};
      (eventToEdit.attendees || []).forEach(id => { status[id] = 'attendee'; });
      (eventToEdit.viewers || []).forEach(id => { status[id] = 'viewer'; });
      setSharingStatus(status);

      // Load attendee statuses
      const statuses: Record<string, string> = {};
      (eventToEdit.attendees_details || []).forEach(d => {
        statuses[d.userId] = d.status;
      });
      setAttendeeStatuses(statuses);

      setEventColor(eventToEdit.color || eventToEdit.creator_color || profile?.calendar_color || 'hsl(217, 91%, 60%)');
      setNotes(eventToEdit.description || '');
      setLocation(eventToEdit.location || '');
      setEventUrl(eventToEdit.url || '');
      setIsTentative(eventToEdit.is_tentative || false);

      toast.info('Editing event', {
        description: 'Update the details below and save your changes.',
      });
    }
  }, [eventToEdit, profile?.calendar_color]);

  // NEW: Listen for Free Time Finder slot data
  useEffect(() => {
    const handlePrefill = () => {
      const prefillData = localStorage.getItem('prefillEventData');
      if (prefillData) {
        try {
          const data = JSON.parse(prefillData);
          setStartDate(data.date);
          setEndDate(data.date);
          setStartTime(convertTo24Hour(data.startTime));
          setEndTime(convertTo24Hour(data.endTime));
          setAttendees(data.attendees || []);

          localStorage.removeItem('prefillEventData');
          toast.success('Event details pre-filled from free time slot');
        } catch (error) {
          console.error('Error parsing prefill data:', error);
        }
      }
    };

    // Check on mount
    handlePrefill();

    // Listen for custom event
    window.addEventListener('navigateToCreateEvent', handlePrefill);
    return () => window.removeEventListener('navigateToCreateEvent', handlePrefill);
  }, []);

  // NEW: Smart date/time prefilling from initialDate or today
  useEffect(() => {
    // Only run for new events (not editing)
    if (eventToEdit) return;

    // Check if we already have a date set (from Free Time Finder or previous interaction)
    const hasExistingDate = startDate && startDate !== '';
    if (hasExistingDate) return;

    const now = new Date();

    if (initialDate) {
      // Use provided initial date from calendar selection
      const dateStr = formatDateForInput(initialDate);
      setStartDate(dateStr);
      setEndDate(dateStr); // Auto-set end date to same day

      // Suggest smart time if not all-day
      if (!isAllDay) {
        const suggestedTime = suggestStartTime(now);
        setStartTime(suggestedTime);
        setEndTime(addHours(suggestedTime, 1)); // +1 hour default duration
      }

      toast.info('Creating event', {
        description: `Pre-filled for ${initialDate.toLocaleDateString()}`,
        duration: 3000,
      });
    } else {
      // Default to today if no date set
      const today = formatDateForInput(now);
      setStartDate(today);
      setEndDate(today);

      // Suggest smart time
      if (!isAllDay) {
        const suggestedTime = suggestStartTime(now);
        setStartTime(suggestedTime);
        setEndTime(addHours(suggestedTime, 1));
      }
    }
  }, [initialDate, eventToEdit, isAllDay]); // Re-run if initialDate changes

  // Draft Auto-Save Logic
  useEffect(() => {
    // Check for draft on mount (only for new events)
    if (!eventToEdit && !initialDate) {
      const savedDraft = localStorage.getItem('freecal_event_draft');
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          // Check if draft is recent (optional, but good practice)? skipping for now

          toast('Unsaved draft found', {
            description: `Title: ${draft.title || '(No Title)'}`,
            action: {
              label: 'Restore',
              onClick: () => {
                setTitle(draft.title || '');
                setNotes(draft.notes || '');
                setStartDate(draft.startDate || '');
                setEndDate(draft.endDate || '');
                setStartTime(draft.startTime || '');
                setEndTime(draft.endTime || '');
                setIsAllDay(draft.isAllDay || false);
                setLocation(draft.location || '');
                setEventUrl(draft.eventUrl || '');
                setRecurrenceType(draft.recurrenceType || 'none');
                setRecurrenceDays(draft.recurrenceDays || []);
                setRecurrenceInterval(draft.recurrenceInterval || 1);
                setAttendees(draft.attendees || []);
                setViewers(draft.viewers || []);
                toast.success('Draft restored!');
              }
            },
            duration: 8000,
          });
        } catch (e) {
          console.error('Failed to parse draft', e);
        }
      }
    }
  }, [eventToEdit, initialDate]);

  useEffect(() => {
    // Don't auto-save if editing an existing event or if strict initialDate is present (maybe?)
    if (eventToEdit) return;

    const draftData = {
      title, notes, startDate, endDate, startTime, endTime, isAllDay,
      location, eventUrl, recurrenceType, recurrenceDays, recurrenceInterval,
      attendees, viewers
    };

    // Debounce save
    const timer = setTimeout(() => {
      // Only save if there is some data
      if (title || notes || location || attendees.length > 0) {
        localStorage.setItem('freecal_event_draft', JSON.stringify(draftData));
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [title, notes, startDate, endDate, startTime, endTime, isAllDay, location, eventUrl, recurrenceType, recurrenceDays, recurrenceInterval, attendees, viewers, eventToEdit]);

  // Conflict Detection
  useEffect(() => {
    if (!startDate || (!isAllDay && !startTime) || !user) {
      setConflictingEvents([]);
      return;
    }

    let start: Date;
    let end: Date;

    try {
      if (isAllDay) {
        start = new Date(`${startDate}T00:00:00`);
        end = new Date(`${endDate || startDate}T23:59:59`);
      } else {
        if (!endTime) return;
        start = new Date(`${startDate}T${startTime}`);
        end = new Date(`${endDate || startDate}T${endTime}`);
      }

      // Overlap check: (StartA < EndB) && (EndA > StartB)
      const conflicts = events.filter(e => {
        if (e.id === editingEventId) return false; // Ignore self

        const eStart = new Date(e.start_time);
        const eEnd = new Date(e.end_time);

        // 1. Time Overlap Check
        const isTimeOverlapping = start < eEnd && end > eStart;
        if (!isTimeOverlapping) return false;

        // 2. Participant Check (Who is busy?)
        // The owner is always considered busy
        const busyUserIds = new Set<string>([e.user_id]);

        // Add all attendees (regardless of status: accepted, tentative, declined, pending)
        if (e.attendees && Array.isArray(e.attendees)) {
          e.attendees.forEach(id => busyUserIds.add(id));
        }

        // Add all viewers ("visible is also enough")
        if (e.viewers && Array.isArray(e.viewers)) {
          e.viewers.forEach(id => busyUserIds.add(id));
        }

        // 3. Relevance Check (Do we care?)
        // We care if:
        // - I am busy (user.id is in busyUserIds)
        // - One of my SELECTED attendees is busy (attendees[i] is in busyUserIds)

        // My ID
        if (busyUserIds.has(user.id)) return true;

        // Selected Attendees IDs
        if (attendees.some(selectedId => busyUserIds.has(selectedId))) return true;

        return false;
      });

      setConflictingEvents(conflicts);
    } catch (e) {
      // Invalid dates
      setConflictingEvents([]);
    }
  }, [startDate, startTime, endDate, endTime, isAllDay, events, editingEventId, attendees, user]);

  // Auto-update end date when start date changes
  useEffect(() => {
    // Skip if editing event (preserve original dates)
    if (eventToEdit) return;

    // If user changes start date and end date is empty or before start date,
    // auto-update end date to match new start date
    if (startDate && (!endDate || endDate < startDate)) {
      setEndDate(startDate);
    }
  }, [startDate, eventToEdit]);

  // Auto-update end time when start time changes
  useEffect(() => {
    // Skip if editing event or all-day event
    if (eventToEdit || isAllDay) return;

    // If user sets start time and no end time yet, suggest +1 hour
    if (startTime && !endTime) {
      const endTimeSuggestion = addHours(startTime, 1);
      setEndTime(endTimeSuggestion);
    }
  }, [startTime, isAllDay, eventToEdit]);

  const handleImportCalendar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsed = parseICS(content);

      if (!parsed) {
        toast.error('Could not parse calendar file', {
          description: 'Please make sure the file is a valid ICSS file.',
        });
        return;
      }

      // Pre-fill form with parsed data
      setTitle(parsed.title);
      setNotes(parsed.description || '');
      setStartDate(parsed.startDate);
      setEndDate(parsed.endDate);
      setStartTime(parsed.startTime || '');
      setEndTime(parsed.endTime || '');
      setIsAllDay(parsed.isAllDay);
      setNotes(parsed.description || '');

      if (parsed.recurrenceRule) {
        // Try to detect recurrence type from RRULE
        if (parsed.recurrenceRule.includes('FREQ=DAILY')) {
          setRecurrenceType('daily');
        } else if (parsed.recurrenceRule.includes('FREQ=WEEKLY')) {
          setRecurrenceType('weekly');
        } else if (parsed.recurrenceRule.includes('FREQ=MONTHLY')) {
          setRecurrenceType('monthly');
        } else {
          setRecurrenceType('custom');
        }
      }

      // Store iOS metadata for later use
      if (parsed.alerts) {
        localStorage.setItem('importedAlerts', JSON.stringify(parsed.alerts));
        // Alerts is string[] in state, but mapped from object in parser?
        // Let's assume we just want to flag that we have alerts, or map them to a simple string representation
        setAlerts(parsed.alerts.map((a: any) => `${a.type}:${a.minutes}`));
      }
      if (parsed.attendees) {
        localStorage.setItem('importedAttendees', JSON.stringify(parsed.attendees));
      }
      if (parsed.isTentative !== undefined) {
        localStorage.setItem('importedIsTentative', JSON.stringify(parsed.isTentative));
        setIsTentative(parsed.isTentative);
      }
      if (parsed.url) {
        localStorage.setItem('importedUrl', parsed.url);
        setEventUrl(parsed.url);
      }
      if (parsed.location) {
        localStorage.setItem('importedLocation', parsed.location);
        setLocation(parsed.location);
      }

      toast.success('Event imported successfully!', {
        description: `Imported: ${parsed.title}. Review and adjust details before saving.`,
      });
    } catch (error) {
      console.error('Error importing calendar:', error);
      toast.error('Error importing calendar', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Reset file input
    e.currentTarget.value = '';
  };

  const handleOCRSuccess = (data: OCREventData) => {
    // Pre-fill form with OCR data
    setTitle(data.title);
    setStartDate(data.startDate);
    setEndDate(data.endDate);
    setIsAllDay(data.isAllDay);

    if (data.startTime) setStartTime(data.startTime);
    if (data.endTime) setEndTime(data.endTime);
    if (data.location) setLocation(data.location);
    if (data.description) setNotes(data.description);
    if (data.url) setEventUrl(data.url);
    if (data.isTentative !== undefined) setIsTentative(data.isTentative);

    toast.success('Event imported from screenshot!', {
      description: `Imported: ${data.title}`,
    });
  };

  const handleSelectOCR = () => {
    setShowScreenshotDialog(true);
  };

  const handleSelectICS = () => {
    icsFileInputRef.current?.click();
  };

  // NEW: Apply quick template presets
  const applyTemplate = (template: string) => {
    const baseDate = startDate || formatDateForInput(new Date());

    switch (template) {
      case 'after-work-evening':
        setStartDate(baseDate);
        setEndDate(baseDate);
        setStartTime('18:00');
        setEndTime('22:00');
        setIsAllDay(false);
        toast.success('Template applied: After work evening');
        break;

      case 'after-work-overnight': {
        setStartDate(baseDate);
        // Calculate next day for end date
        const start = new Date(baseDate);
        const nextDay = new Date(start);
        nextDay.setDate(start.getDate() + 1);
        setEndDate(formatDateForInput(nextDay));

        setStartTime('18:00');
        setEndTime('08:00');
        setIsAllDay(false);
        toast.success('Template applied: After work overnight');
        break;
      }

      case 'day':
        setStartDate(baseDate);
        setEndDate(baseDate);
        setStartTime('09:00');
        setEndTime('17:00');
        setIsAllDay(false);
        toast.success('Template applied: Day (9-5)');
        break;

      case 'day-overnight': {
        setStartDate(baseDate);
        // Calculate next day for end date
        const start = new Date(baseDate);
        const nextDay = new Date(start);
        nextDay.setDate(start.getDate() + 1);
        setEndDate(formatDateForInput(nextDay));

        setStartTime('09:00');
        setEndTime('08:00');
        setIsAllDay(false);
        toast.success('Template applied: Day + Overnight');
        break;
      }

      default:
        break;
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error('Please enter an event title');
      return;
    }

    if (!startDate) {
      toast.error('Please select a start date');
      return;
    }

    if (!user) {
      toast.error('You must be signed in to create events');
      return;
    }

    // VALIDATE: End date/time must be after start date/time
    const startDateTime = isAllDay
      ? new Date(startDate)
      : new Date(`${startDate}T${startTime}`);

    const endDateTime = isAllDay
      ? new Date(endDate || startDate)
      : new Date(`${endDate || startDate}T${endTime || startTime}`);

    // For all-day events, only check dates (end can equal start for single-day events)
    // For timed events, end must be strictly after start
    if (isAllDay) {
      // Compare only dates for all-day events
      const startDateOnly = new Date(startDate).setHours(0, 0, 0, 0);
      const endDateOnly = new Date(endDate || startDate).setHours(0, 0, 0, 0);

      if (endDateOnly < startDateOnly) {
        toast.error('End date must be on or after start date', {
          description: 'Please adjust your event dates.',
        });
        return;
      }
    } else {
      // For timed events, end must be after start
      if (endDateTime <= startDateTime) {
        toast.error('End time must be after start time', {
          description: 'Please adjust your event dates and times.',
        });
        return;
      }
    }

    const attendeesList = Object.entries(sharingStatus)
      .filter(([_, status]) => status === 'attendee')
      .map(([userId]) => userId);

    const viewersList = Object.entries(sharingStatus)
      .filter(([_, status]) => status === 'viewer')
      .map(([userId]) => userId);


    // Validation
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (startDate && endDate && endDate < startDate) {
      newErrors.endDate = 'End date cannot be before start date';
    }
    if (!isAllDay && startDate === endDate && startTime && endTime && endTime <= startTime) {
      newErrors.endTime = 'End time must be after start time';
    }
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      toast.error('Please fix validation errors');
      return;
    }

    setSaving(true);

    try {
      const startDateTimeIso = isAllDay
        ? new Date(startDate).toISOString()
        : new Date(`${startDate}T${startTime}`).toISOString();

      const endDateTimeIso = isAllDay
        ? new Date(endDate || startDate).toISOString()
        : new Date(`${endDate || startDate}T${endTime || startTime}`).toISOString();

      const eventData = {
        title: title.trim(),
        description: notes.trim() || null,
        start_time: startDateTimeIso,
        end_time: endDateTimeIso,
        is_all_day: isAllDay,
        color: eventColor,
        recurrence_type: recurrenceType,
        recurrence_days: recurrenceDays.length > 0 ? recurrenceDays : null,
        recurrence_interval: recurrenceType !== 'none' ? recurrenceInterval : null,
        recurrence_end_date: recurrenceEndDate || null,
        imported_from_device: false,
        location: location.trim() || null,
        url: eventUrl.trim() || null,
        is_tentative: isTentative,
        attendees: attendeesList,
        viewers: viewersList,
      };

      if (editingEventId) {
        // UPDATE existing event
        await api.put(`/events/${editingEventId}`, eventData);

        toast.success('Event updated successfully!');
        resetForm();
        if (onEventSaved) {
          onEventSaved({ start_time: eventData.start_time });
        }
      } else {
        // CREATE new event
        await api.post('/events', eventData);

        toast.success('Event created successfully!');
        resetForm();
        if (onEventSaved) {
          onEventSaved({ start_time: eventData.start_time });
        }
      }
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(`Error: ${err.response?.data?.message || err.message}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    localStorage.removeItem('freecal_event_draft'); // Clear draft
    setErrors({}); // Clear errors
    setEditingEventId(null);
    setTitle('');
    setNotes('');
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setIsAllDay(false);
    setRecurrenceType('none');
    setRecurrenceDays([]);
    setRecurrenceInterval(1);
    setRecurrenceEndDate('');
    setAttendees([]);
    setViewers([]);
    setSharingStatus({});
    setEventColor(profile?.calendar_color || 'hsl(217, 91%, 60%)');
    setLocation('');
    setEventUrl('');
    setIsTentative(false);
  };

  const toggleAttendee = (userId: string) => {
    setAttendees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleViewer = (userId: string) => {
    setViewers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleRecurrenceDay = (day: string) => {
    setRecurrenceDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const toggleSharingStatus = (userId: string) => {
    setSharingStatus((prev) => {
      const current = prev[userId] || 'none';
      const next = current === 'none' ? 'viewer' : current === 'viewer' ? 'attendee' : 'none';
      return { ...prev, [userId]: next };
    });
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save: Ctrl+S or Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const form = document.querySelector('form');
        if (form) form.requestSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (relLoading) {
    return (
      <div className="flex flex-col h-screen bg-background items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <MobileHeader
        title={editingEventId ? "Edit Event" : "Create Event"}
        leftAction={
          editingEventId ? (
            <button
              className="text-sm text-muted-foreground"
              onClick={() => {
                resetForm();
                if (onEventSaved) {
                  onEventSaved();
                }
              }}
            >
              Cancel
            </button>
          ) : undefined
        }
        rightAction={
          !editingEventId ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowImportDialog(true)}
                className="flex items-center gap-1"
              >
                <Upload className="w-4 h-4" />
                <span className="text-xs">Import</span>
              </Button>
              {/* Hidden ICs file input */}
              <input
                ref={icsFileInputRef}
                type="file"
                accept=".ics,.ical,.ifb,.icalendar"
                onChange={handleImportCalendar}
                className="hidden"
              />
            </div>
          ) : undefined
        }
      />

      <ImportMethodDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSelectOCR={handleSelectOCR}
        onSelectICS={handleSelectICS}
      />

      <ScreenshotImportDialog
        open={showScreenshotDialog}
        onOpenChange={setShowScreenshotDialog}
        onImportSuccess={handleOCRSuccess}
      />

      <div className="flex-1 overflow-y-auto pb-20 px-4">


        <form onSubmit={handleSave} className="space-y-6 pt-4">


          {/* Conflict Warning */}
          {conflictingEvents.length > 0 && (
            <div className="bg-red-500/10 backdrop-blur-md border border-red-500/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg flex flex-col gap-1 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2 font-medium text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Conflict detected with {conflictingEvents.length} existing event{conflictingEvents.length > 1 ? 's' : ''}</span>
              </div>
              <ul className="list-disc list-inside text-xs pl-5 opacity-90">
                {conflictingEvents.slice(0, 3).map(e => (
                  <li key={e.id}>
                    {e.title} ({new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(e.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </li>
                ))}
                {conflictingEvents.length > 3 && <li>+ {conflictingEvents.length - 3} more</li>}
              </ul>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              placeholder="Team meeting, Lunch, etc."
              className={`bg-card ${errors.title ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors({ ...errors, title: '' });
              }}
              required
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
          </div>

          {/* Quick Templates - Only show for new events */}
          {!editingEventId && (
            <div className="bg-muted/30 rounded-lg p-4">
              <Label className="text-sm font-medium mb-3 block">Quick Templates</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate('after-work-evening')}
                  className="text-xs h-9"
                >
                  🌆 After Work
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate('after-work-overnight')}
                  className="text-xs h-9"
                >
                  🌙 Overnight
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate('day')}
                  className="text-xs h-9"
                >
                  ☀️ Day
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate('day-overnight')}
                  className="text-xs h-9"
                >
                  🌅 Day + Night
                </Button>
              </div>
            </div>
          )}

          {/* Date and Time Consolidated */}
          <div className={`grid gap-3 ${isAllDay ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-xs">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                className="bg-card"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            {!isAllDay && (
              <div className="space-y-2">
                <Label htmlFor="start-time" className="text-xs">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  className="bg-card"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-xs">End Date</Label>
              <Input
                id="end-date"
                type="date"
                className={`bg-card ${errors.endDate ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  if (errors.endDate) setErrors({ ...errors, endDate: '' });
                }}
                required
              />
            </div>

            {!isAllDay && (
              <div className="space-y-2">
                <Label htmlFor="end-time" className="text-xs">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  className={`bg-card ${errors.endTime ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    if (errors.endTime) setErrors({ ...errors, endTime: '' });
                  }}
                  required
                />
              </div>
            )}
          </div>

          {(errors.endDate) && <p className="text-red-500 text-xs">{errors.endDate}</p>}
          {(errors.endTime) && <p className="text-red-500 text-xs">{errors.endTime}</p>}

          {/* All-day toggle */}
          <div className="flex items-center justify-between bg-card p-4 rounded-lg">
            <Label htmlFor="all-day" className="cursor-pointer">
              All-day event
            </Label>
            <Switch id="all-day" checked={isAllDay} onCheckedChange={setIsAllDay} />
          </div>

          {/* Recurrence toggle */}
          <div className="flex items-center justify-between bg-card p-4 rounded-lg">
            <Label htmlFor="recurrence" className="cursor-pointer">
              Recurring event
            </Label>
            <Switch
              id="recurrence"
              checked={recurrenceType !== 'none'}
              onCheckedChange={() =>
                setRecurrenceType((prev) => (prev === 'none' ? 'daily' : 'none'))
              }
            />
          </div>

          {/* Recurrence options */}
          {recurrenceType !== 'none' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="recurrence-type">Recurrence Pattern</Label>
                <Select
                  value={recurrenceType}
                  onValueChange={(value: 'daily' | 'weekly' | 'monthly' | 'custom' | 'none') =>
                    setRecurrenceType(value)
                  }
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="Select pattern" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recurrenceType === 'weekly' && (
                <div className="space-y-2">
                  <Label>Repeat on</Label>
                  <div className="grid grid-cols-7 gap-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => toggleRecurrenceDay(index.toString())}
                        className={`aspect-square rounded-lg transition-colors text-sm font-medium ${recurrenceDays.includes(index.toString())
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card hover:bg-accent'
                          }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recurrenceType === 'custom' && (
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="interval">Repeat every (days)</Label>
                    <Input
                      id="interval"
                      type="number"
                      min="1"
                      value={recurrenceInterval}
                      onChange={(e) => setRecurrenceInterval(parseInt(e.target.value))}
                      className="bg-card"
                    />
                  </div>
                </div>
              )}

              {/* Recurrence End Date */}
              <div className="space-y-2">
                <Label htmlFor="recurrence-end">Ends by (optional)</Label>
                <Input
                  id="recurrence-end"
                  type="date"
                  className="bg-card"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                  min={startDate}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for no end date
                </p>
              </div>
            </div>
          )}

          {/* Share with (Unified) */}
          <div className="space-y-2">
            <Label>Share with</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Tap to cycle: None → Visible To → Attendee
            </p>
            <div className="space-y-2">
              {relationships.map((rel) => {
                const status = sharingStatus[rel.profile.id] || 'none';

                return (
                  <button
                    key={rel.id}
                    type="button"
                    onClick={() => toggleSharingStatus(rel.profile.id)}
                    className="w-full flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent transition-colors"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: rel.profile.calendar_color }}
                    />
                    <span className="flex-1 text-left text-sm">
                      {rel.profile.display_name}
                    </span>
                    {status === 'viewer' && (
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs">
                          👁️
                        </div>
                        <span className="text-xs text-muted-foreground">Visible</span>
                      </div>
                    )}
                    {status === 'attendee' && (
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                          ✓
                        </div>
                        <span className="text-xs text-foreground">Attendee</span>
                      </div>
                    )}
                  </button>
                );
              })}
              {relationships.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No relationships yet. Add connections in your profile.
                </p>
              )}
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="Meeting room, address, etc."
              className="bg-card"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* Event URL */}
          <div className="space-y-2">
            <Label htmlFor="event-url">Event URL / Meeting Link</Label>
            <Input
              id="event-url"
              type="url"
              placeholder="https://example.com/meeting"
              className="bg-card"
              value={eventUrl}
              onChange={(e) => setEventUrl(e.target.value)}
            />
          </div>

          {/* Tentative Status */}
          <div className="flex items-center justify-between bg-card p-4 rounded-lg">
            <Label htmlFor="tentative" className="cursor-pointer">
              Mark as tentative
            </Label>
            <Switch id="tentative" checked={isTentative} onCheckedChange={setIsTentative} />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Notes</Label>
            <Textarea
              id="description"
              placeholder="Add notes or description..."
              className="bg-card min-h-24 resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Imported Alerts - only show if there are alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              <Label>Imported Alerts</Label>
              <Textarea
                placeholder="Alerts..."
                className="bg-card min-h-12 resize-none"
                value={alerts.join('\n')}
                onChange={(e) => setAlerts(e.target.value.split('\n'))}
              />
            </div>
          )}

          {/* Submit buttons */}
          <div className="space-y-2">
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {editingEventId ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  {editingEventId ? 'Update Event' : 'Create Event'}
                </>
              )}
            </Button>
            {editingEventId && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  resetForm();
                  if (onEventSaved) {
                    onEventSaved();
                  }
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}