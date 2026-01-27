import { useState } from 'react';
import { BottomNav } from '@/components/calendar/BottomNav';
import { CalendarView } from './CalendarView';
import { CreateEvent } from './CreateEvent';
import { FreeTimeFinder } from './FreeTimeFinder';
import { FreeTimeFinderV2 } from './FreeTimeFinderV2';
import { Profile } from './Profile';
import { WorldMap } from './WorldMap';
import { Toaster } from '@/components/ui/sonner';
import { EventWithAttendees } from '@/hooks/useEvents';

type ActiveTab = 'calendar' | 'create' | 'worldmap' | 'freetime' | 'profile';

function Index() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar');
  const [eventToEdit, setEventToEdit] = useState<EventWithAttendees | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);

  const handleEditEvent = (event: EventWithAttendees) => {
    console.log('Index: Setting event to edit:', event);
    setEventToEdit(event);
    setSelectedCalendarDate(null); // Clear selected date when editing
    setActiveTab('create');
  };

  const handleEventSaved = () => {
    setEventToEdit(null);
    setSelectedCalendarDate(null); // Clear selected date after save
    setActiveTab('calendar');
  };

  const handleCalendarDateChange = (date: Date | null) => {
    setSelectedCalendarDate(date);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'calendar':
        return <CalendarView onEditEvent={handleEditEvent} onSelectedDateChange={handleCalendarDateChange} />;
      case 'create':
        return <CreateEvent eventToEdit={eventToEdit} onEventSaved={handleEventSaved} initialDate={selectedCalendarDate} />;
      case 'worldmap':
        return <WorldMap />;
      case 'freetime':
        return <FreeTimeFinderV2 />;
      case 'profile':
        return <Profile />;
      default:
        return <CalendarView onEditEvent={handleEditEvent} onSelectedDateChange={handleCalendarDateChange} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {renderContent()}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      <Toaster />
    </div>
  );
}

export default Index;
