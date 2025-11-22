import { useState } from 'react';
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

type EventInsert = Database['public']['Tables']['events']['Insert'];
type AttendeeInsert = Database['public']['Tables']['event_attendees']['Insert'];

export function CreateEvent() {
  const { user, profile } = useAuth();
  const { relationships, loading: relLoading } = useRelationships();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [hasRecurrence, setHasRecurrence] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>([]);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setLoading(true);

    try {
      // Construct datetime strings
      const startDateTime = isAllDay
        ? `${startDate}T00:00:00Z`
        : `${startDate}T${startTime}:00Z`;
      const endDateTime = isAllDay
        ? `${endDate}T23:59:59Z`
        : `${endDate}T${endTime}:00Z`;

      // Sanitize form data
      const eventData: EventInsert = {
        user_id: user.id,
        title,
        start_time: startDateTime,
        end_time: endDateTime,
        is_all_day: isAllDay,
        color: profile.calendar_color,
        recurrence_type: hasRecurrence ? recurrenceType : 'none',
      };

      // Add optional fields only if they have values
      if (description) eventData.description = description;
      if (hasRecurrence && recurrenceInterval) eventData.recurrence_interval = recurrenceInterval;
      if (hasRecurrence && recurrenceDays.length > 0) eventData.recurrence_days = recurrenceDays;

      // Create event
      const { data: event, error: eventError } = await supabase
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

      // Add attendees (including creator)
      const attendeeRecords: AttendeeInsert[] = [user.id, ...selectedAttendees].map((userId) => ({
        event_id: event.id,
        user_id: userId,
      }));

      const { error: attendeesError } = await supabase
        .from('event_attendees')
        .insert(attendeeRecords);

      if (attendeesError) {
        console.error('Attendees error:', attendeesError);
        toast.error(`Attendees Error: ${attendeesError.message}`, {
          description: 'Copy this error and paste in chat for help',
          duration: 10000,
        });
      }

      toast.success('Event created successfully!', {
        description: 'Your event has been added to the calendar.',
      });

      // Reset form
      setTitle('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setStartTime('');
      setEndTime('');
      setIsAllDay(false);
      setHasRecurrence(false);
      setSelectedAttendees([]);
    } catch (err) {
      console.error('Create event error:', err);
      toast.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
        description: 'Copy this error and paste in chat for help',
        duration: 10000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImportCalendar = () => {
    toast.info('Calendar import', {
      description: 'This feature will allow importing events from your device calendar.',
    });
  };

  const toggleAttendee = (userId: string) => {
    setSelectedAttendees((prev) =>
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
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
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
              checked={hasRecurrence}
              onCheckedChange={setHasRecurrence}
            />
          </div>

          {/* Recurrence options */}
          {hasRecurrence && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="recurrence-type">Recurrence Pattern</Label>
                <Select
                  value={recurrenceType}
                  onValueChange={(value: 'daily' | 'weekly' | 'monthly' | 'custom') => setRecurrenceType(value)}
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
                  {selectedAttendees.includes(rel.profile.id) && (
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Submit button */}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
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