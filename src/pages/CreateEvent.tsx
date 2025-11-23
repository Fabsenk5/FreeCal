import { useState, useEffect } from 'react';
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
import { supabase, Database } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { EventWithAttendees } from '@/hooks/useEvents';

type EventInsert = Database['public']['Tables']['events']['Insert'];
type AttendeeInsert = Database['public']['Tables']['event_attendees']['Insert'];

export function CreateEvent() {
  const { user, profile } = useAuth();
  const { relationships, loading: relLoading } = useRelationships();

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventColor, setEventColor] = useState<string>(profile?.calendar_color || 'hsl(217, 91%, 60%)');
  const [notes, setNotes] = useState<string>('');
  const [attendees, setAttendees] = useState<string[]>([]);
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

  // Listen for edit event
  useEffect(() => {
    const handleEditEvent = (e: CustomEvent) => {
      const event = e.detail as EventWithAttendees;
      setEditingEventId(event.id);
      setTitle(event.title);
      
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);
      
      setStartDate(start.toISOString().split('T')[0]);
      setStartTime(start.toTimeString().slice(0, 5));
      setEndDate(end.toISOString().split('T')[0]);
      setEndTime(end.toTimeString().slice(0, 5));
      setIsAllDay(event.is_all_day);
      setRecurrenceType(event.recurrence_type);
      setRecurrenceDays(event.recurrence_days || []);
      setRecurrenceInterval(event.recurrence_interval || 1);
      setAttendees(event.attendees || []);
      setEventColor(event.color);
      setNotes(event.description || '');
      
      toast.info('Editing event', {
        description: 'Update the details and save.',
      });
    };

    window.addEventListener('editEvent', handleEditEvent as EventListener);
    return () => window.removeEventListener('editEvent', handleEditEvent as EventListener);
  }, []);

  const handleSave = async () => {
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

    setSaving(true);

    try {
      const startDateTime = isAllDay
        ? new Date(startDate).toISOString()
        : new Date(`${startDate}T${startTime}`).toISOString();

      const endDateTime = isAllDay
        ? new Date(endDate || startDate).toISOString()
        : new Date(`${endDate || startDate}T${endTime || startTime}`).toISOString();

      const eventData = {
        user_id: user.id,
        title: title.trim(),
        description: notes.trim() || null,
        start_time: startDateTime,
        end_time: endDateTime,
        is_all_day: isAllDay,
        color: eventColor,
        recurrence_type: recurrenceType,
        recurrence_days: recurrenceDays.length > 0 ? recurrenceDays : null,
        recurrence_interval: recurrenceType !== 'none' ? recurrenceInterval : null,
        recurrence_end_date: null,
        imported_from_device: false,
      };

      if (editingEventId) {
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

        await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', editingEventId);

        if (attendees.length > 0) {
          const attendeeRecords = attendees.map((attendeeId) => ({
            event_id: editingEventId,
            user_id: attendeeId,
          }));

          await supabase.from('event_attendees').insert(attendeeRecords);
        }

        toast.success('Event updated successfully!');
      } else {
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

        const attendeeRecords = [
          { event_id: newEvent.id, user_id: user.id },
          ...attendees.map((attendeeId) => ({
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

        toast.success('Event created successfully!');
      }

      resetForm();
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
    setEventColor(profile?.calendar_color || 'hsl(217, 91%, 60%)');
  };

  const handleImportCalendar = () => {
    toast.info('Calendar import', {
      description: 'This feature will allow importing events from your device calendar.',
    });
  };

  const toggleAttendee = (userId: string) => {
    setAttendees((prev) =>
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
        title="Create Event"
        rightAction={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleImportCalendar}
            className="flex items-center gap-1"
          >
            <Upload className="w-4 h-4" />
            <span className="text-xs">Import</span>
          </Button>
        }
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

          {/* Submit button */}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 mr-2" />
                Create Event
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}