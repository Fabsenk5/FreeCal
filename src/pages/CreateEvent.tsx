import React, { useState, useEffect, useRef } from 'react';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRelationships } from '@/hooks/useRelationships';
import { Calendar, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { EventWithAttendees } from '@/hooks/useEvents';
import { parseICS, ParsedEvent } from '@/utils/icsParser';
import { ImportMethodDialog } from '@/components/calendar/ImportMethodDialog';
import { ScreenshotImportDialog } from '@/components/calendar/ScreenshotImportDialog';
import { OCREventData } from '@/utils/calendarOCR';

interface CreateEventProps {
  eventToEdit?: EventWithAttendees | null;
  onEventSaved?: () => void;
}

export function CreateEvent({ eventToEdit, onEventSaved }: CreateEventProps) {
  const { user, profile } = useAuth();
  const { relationships, loading: relLoading } = useRelationships();

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
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<string>('');
  const [eventUrl, setEventUrl] = useState<string>('');
  const [isTentative, setIsTentative] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);
  const icsFileInputRef = useRef<HTMLInputElement>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showScreenshotDialog, setShowScreenshotDialog] = useState(false);
  const [sharingStatus, setSharingStatus] = useState<Record<string, 'attendee' | 'viewer' | 'none'>>({});

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
      setAttendees(eventToEdit.attendees || []);
      setViewers(eventToEdit.viewers || []);
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
        setAlerts(parsed.alerts);
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

    if (endDateTime <= startDateTime) {
      toast.error('End time must be after start time', {
        description: 'Please adjust your event dates and times.',
      });
      return;
    }

    // Build attendees and viewers arrays from unified sharing status
    const attendeesList = Object.entries(sharingStatus)
      .filter(([_, status]) => status === 'attendee')
      .map(([userId]) => userId);
    
    const viewersList = Object.entries(sharingStatus)
      .filter(([_, status]) => status === 'viewer')
      .map(([userId]) => userId);

    setSaving(true);

    try {
      const startDateTimeIso = isAllDay
        ? new Date(startDate).toISOString()
        : new Date(`${startDate}T${startTime}`).toISOString();

      const endDateTimeIso = isAllDay
        ? new Date(endDate || startDate).toISOString()
        : new Date(`${endDate || startDate}T${endTime || startTime}`).toISOString();

      const eventData = {
        user_id: user.id,
        title: title.trim(),
        description: notes.trim() || null,
        start_time: startDateTimeIso,
        end_time: endDateTimeIso,
        is_all_day: isAllDay,
        color: eventColor,
        recurrence_type: recurrenceType,
        recurrence_days: recurrenceDays.length > 0 ? recurrenceDays : null,
        recurrence_interval: recurrenceType !== 'none' ? recurrenceInterval : null,
        recurrence_end_date: null,
        imported_from_device: false,
        location: location.trim() || null,
        url: eventUrl.trim() || null,
        is_tentative: isTentative,
      };

      if (editingEventId) {
        // UPDATE existing event
        const { error: updateError } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', editingEventId);

        if (updateError) {
          toast.error(`Update Error: ${updateError.message}`, {
            description: 'Copy this error and paste in chat for help',
            duration: 10000,
          });
          return;
        }

        // Update attendees
        await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', editingEventId);

        if (attendeesList.length > 0) {
          const attendeeRecords = attendeesList.map((attendeeId) => ({
            event_id: editingEventId,
            user_id: attendeeId,
          }));

          await supabase.from('event_attendees').insert(attendeeRecords);
        }

        // Update viewers
        await supabase
          .from('event_viewers')
          .delete()
          .eq('event_id', editingEventId);

        if (viewersList.length > 0) {
          const viewerRecords = viewersList.map((viewerId) => ({
            event_id: editingEventId,
            user_id: viewerId,
          }));

          await supabase.from('event_viewers').insert(viewerRecords);
        }

        toast.success('Event updated successfully!');
        resetForm();
        if (onEventSaved) {
          onEventSaved();
        }
      } else {
        // CREATE new event
        const { data: newEvent, error: eventError } = await supabase
          .from('events')
          .insert(eventData)
          .select()
          .single();

        if (eventError) {
          toast.error(`Database Error: ${eventError.message}`, {
            description: 'Copy this error and paste in chat for help',
            duration: 10000,
          });
          return;
        }

        // Add creator and attendees
        const attendeeRecords = [
          { event_id: newEvent.id, user_id: user.id },
          ...attendeesList.map((attendeeId) => ({
            event_id: newEvent.id,
            user_id: attendeeId,
          })),
        ];

        const { error: attendeeError } = await supabase
          .from('event_attendees')
          .insert(attendeeRecords);

        if (attendeeError) {
          console.error('Error adding attendees:', attendeeError);
        }

        // Add viewers
        if (viewersList.length > 0) {
          const viewerRecords = viewersList.map((viewerId) => ({
            event_id: newEvent.id,
            user_id: viewerId,
          }));

          const { error: viewerError } = await supabase
            .from('event_viewers')
            .insert(viewerRecords);

          if (viewerError) {
            console.error('Error adding viewers:', viewerError);
          }
        }

        toast.success('Event created successfully!');
        resetForm();
        if (onEventSaved) {
          onEventSaved();
        }
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
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
    setAttendees([]);
    setViewers([]);
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

      <div className="flex-1 overflow-y-auto pb-24 px-4">
        <form onSubmit={handleSave} className="space-y-6 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Event Title</Label>
            <Input
              id="title"
              placeholder="Team meeting, Lunch, etc."
              className="bg-card"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                className="bg-card"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                className="bg-card"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* All-day toggle */}
          <div className="flex items-center justify-between bg-card p-4 rounded-lg">
            <Label htmlFor="all-day" className="cursor-pointer">
              All-day event
            </Label>
            <Switch id="all-day" checked={isAllDay} onCheckedChange={setIsAllDay} />
          </div>

          {/* Time pickers */}
          {!isAllDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  className="bg-card"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  className="bg-card"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

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
                        className={`aspect-square rounded-lg transition-colors text-sm font-medium ${
                          recurrenceDays.includes(index.toString())
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
            </div>
          )}

          {/* Attendees */}
          <div className="space-y-2">
            <Label>Attendees</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Attendees will block their calendar time
            </p>
            <div className="space-y-2">
              {relationships.map((rel) => (
                <button
                  key={rel.id}
                  type="button"
                  onClick={() => toggleAttendee(rel.profile.id)}
                  className="w-full flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent transition-colors"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: rel.profile.calendar_color }}
                  />
                  <span className="flex-1 text-left text-sm">
                    {rel.profile.display_name}
                  </span>
                  {attendees.includes(rel.profile.id) && (
                    <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                      ✓
                    </div>
                  )}
                </button>
              ))}
              {relationships.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No relationships yet. Add connections in your profile.
                </p>
              )}
            </div>
          </div>

          {/* Viewers */}
          <div className="space-y-2">
            <Label>Visible to</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Viewers can see the event but won't block their calendar
            </p>
            <div className="space-y-2">
              {relationships.map((rel) => (
                <button
                  key={rel.id}
                  type="button"
                  onClick={() => toggleViewer(rel.profile.id)}
                  className="w-full flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent transition-colors"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: rel.profile.calendar_color }}
                  />
                  <span className="flex-1 text-left text-sm">
                    {rel.profile.display_name}
                  </span>
                  {viewers.includes(rel.profile.id) && (
                    <div className="w-5 h-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs">
                      ✓
                    </div>
                  )}
                </button>
              ))}
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