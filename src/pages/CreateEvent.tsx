import { useState } from 'react';
import { MobileHeader } from '@/components/calendar/MobileHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MOCK_USERS } from '@/data/mockData';
import { Calendar, Upload } from 'lucide-react';
import { toast } from 'sonner';

export function CreateEvent() {
  const [isAllDay, setIsAllDay] = useState(false);
  const [hasRecurrence, setHasRecurrence] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<string>('');
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [eventColor, setEventColor] = useState('self');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Event created successfully!', {
      description: 'Your event has been added to the calendar.',
    });
  };

  const handleImportCalendar = () => {
    toast.info('Calendar import', {
      description: 'This would open your device calendar to import events.',
    });
  };

  const toggleAttendee = (userId: string) => {
    setSelectedAttendees(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const colors = [
    { value: 'self', label: 'Blue (You)', color: 'hsl(var(--user-self))' },
    { value: 'partner1', label: 'Purple', color: 'hsl(var(--user-partner1))' },
    { value: 'partner2', label: 'Green', color: 'hsl(var(--user-partner2))' },
  ];

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
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                className="bg-card"
                required
              />
            </div>
          </div>

          {/* All-day toggle */}
          <div className="flex items-center justify-between bg-card p-4 rounded-lg">
            <Label htmlFor="all-day" className="cursor-pointer">All-day event</Label>
            <Switch
              id="all-day"
              checked={isAllDay}
              onCheckedChange={setIsAllDay}
            />
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
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  className="bg-card"
                  required
                />
              </div>
            </div>
          )}

          {/* Recurrence toggle */}
          <div className="flex items-center justify-between bg-card p-4 rounded-lg">
            <Label htmlFor="recurrence" className="cursor-pointer">Recurring event</Label>
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
                <Select value={recurrenceType} onValueChange={setRecurrenceType}>
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
                        className="aspect-square rounded-lg bg-card hover:bg-primary hover:text-primary-foreground transition-colors text-sm font-medium"
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recurrenceType === 'custom' && (
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="interval">Every</Label>
                      <Input
                        id="interval"
                        type="number"
                        min="1"
                        defaultValue="1"
                        className="bg-card"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="interval-unit">Period</Label>
                      <Select defaultValue="days">
                        <SelectTrigger className="bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="days">Days</SelectItem>
                          <SelectItem value="weeks">Weeks</SelectItem>
                          <SelectItem value="months">Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attendees */}
          <div className="space-y-2">
            <Label>Attendees</Label>
            <div className="space-y-2">
              {MOCK_USERS.map(user => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggleAttendee(user.id)}
                  className="w-full flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent transition-colors"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: `hsl(var(--user-${user.color}))` }}
                  />
                  <span className="flex-1 text-left text-sm">{user.name}</span>
                  {selectedAttendees.includes(user.id) && (
                    <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                      ✓
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <Label>Event Color</Label>
            <div className="grid grid-cols-3 gap-2">
              {colors.map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setEventColor(color.value)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    eventColor === color.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: color.color }}
                    />
                    <span className="text-xs font-medium">{color.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Notes</Label>
            <Textarea
              id="description"
              placeholder="Add notes or description..."
              className="bg-card min-h-24 resize-none"
            />
          </div>

          {/* Submit buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Create Event
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
