import { useState } from 'react';
import { BottomNav } from '@/components/calendar/BottomNav';
import { CalendarView } from './CalendarView';
import { CreateEvent } from './CreateEvent';
import { FreeTimeFinder } from './FreeTimeFinder';
import { Profile } from './Profile';
import { Toaster } from '@/components/ui/sonner';

type ActiveTab = 'calendar' | 'create' | 'freetime' | 'profile';

function Index() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar');

  const renderContent = () => {
    switch (activeTab) {
      case 'calendar':
        return <CalendarView />;
      case 'create':
        return <CreateEvent />;
      case 'freetime':
        return <FreeTimeFinder />;
      case 'profile':
        return <Profile />;
      default:
        return <CalendarView />;
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