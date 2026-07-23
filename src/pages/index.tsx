import { useState, useEffect, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { BottomNav } from '@/components/calendar/BottomNav';
import { CalendarView } from './CalendarView';
import { FreeTimeFinderV2 } from './FreeTimeFinderV2';
import { Profile } from './Profile';
import { EventWithAttendees } from '@/hooks/useEvents';
import { supabase } from '@/lib/supabase';

// Lazy-load heavy tabs: CreateEvent pulls in the ICS/OCR import chain,
// WorldMap pulls in leaflet. They load on first visit of the tab.
// FreeTimeFinderV2 stays eager as a core feature (no suspense flash).
const CreateEvent = lazy(() => import('./CreateEvent').then(m => ({ default: m.CreateEvent })));
const WorldMap = lazy(() => import('./WorldMap').then(m => ({ default: m.WorldMap })));

const TabFallback = () => (
  <div className="flex flex-col h-screen bg-background items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
    <p className="text-muted-foreground">Loading...</p>
  </div>
);

type ActiveTab = 'calendar' | 'create' | 'worldmap' | 'freetime' | 'profile';

const VALID_TABS: ActiveTab[] = ['calendar', 'create', 'worldmap', 'freetime', 'profile'];

function Index() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar');
  const [eventToEdit, setEventToEdit] = useState<EventWithAttendees | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const handleEditEvent = (event: EventWithAttendees) => {
    console.log('Index: Setting event to edit:', event);
    setEventToEdit(event);
    setSelectedCalendarDate(null); // Clear selected date when editing
    setActiveTab('create');
  };

  const handleEventSaved = (savedEvent?: { start_time: string }) => {
    setEventToEdit(null);
    // The calendar tab remounts with the cached events query; without
    // invalidation React Query serves the pre-edit data while it is still
    // fresh (staleTime 60s), so a just-saved event appeared unchanged.
    void queryClient.invalidateQueries({ queryKey: ['events'] });
    if (savedEvent) {
      setSelectedCalendarDate(new Date(savedEvent.start_time));
    } else {
      setSelectedCalendarDate(null);
    }
    setActiveTab('calendar');
  };

  const handleCalendarDateChange = (date: Date | null) => {
    setSelectedCalendarDate(date);
  };

  const handleQuickCreate = (date: Date) => {
    setSelectedCalendarDate(date);
    setActiveTab('create');
  };

  // Deep-linking: handle eventId and tab query params
  useEffect(() => {
    const eventId = searchParams.get('eventId');
    const tab = searchParams.get('tab');

    if (eventId) {
      // Load the event from supabase and open it for editing
      (async () => {
        try {
          const { data: event } = await supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .single();

          if (event) {
            // Fetch attendees and viewers
            const [attendeesResult, viewersResult] = await Promise.all([
              supabase.from('event_attendees').select('*').eq('event_id', eventId),
              supabase.from('event_viewers').select('user_id').eq('event_id', eventId),
            ]);

            const attendees = attendeesResult.data || [];
            const viewers = viewersResult.data || [];

            const eventWithAttendees: EventWithAttendees = {
              ...event,
              attendees: attendees.map(a => a.user_id),
              attendees_details: attendees.map(a => ({
                userId: a.user_id,
                status: a.status as 'pending' | 'accepted' | 'declined',
              })),
              viewers: viewers.map(v => v.user_id),
            };

            handleEditEvent(eventWithAttendees);
          }
        } catch (e) {
          console.error('Deep-link: failed to load event', e);
        }

        // Clean up the URL param
        searchParams.delete('eventId');
        setSearchParams(searchParams, { replace: true });
      })();
    }

    if (tab) {
      const validTabs: ActiveTab[] = ['calendar', 'create', 'worldmap', 'freetime', 'profile'];
      if (validTabs.includes(tab as ActiveTab)) {
        setActiveTab(tab as ActiveTab);
      }
      // Clean up the URL param
      searchParams.delete('tab');
      setSearchParams(searchParams, { replace: true });
    }
  }, []); // Run once on mount

  // Tab-switch requests from embedded pages (e.g. the Free Time Finder's
  // "create from slot" flow dispatches 'freecal:switch-tab')
  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: string }>).detail?.tab;
      if (tab && VALID_TABS.includes(tab as ActiveTab)) {
        setActiveTab(tab as ActiveTab);
      }
    };
    window.addEventListener('freecal:switch-tab', handleSwitchTab);
    return () => window.removeEventListener('freecal:switch-tab', handleSwitchTab);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'calendar':
        return <CalendarView
          onEditEvent={handleEditEvent}
          onSelectedDateChange={handleCalendarDateChange}
          onQuickCreate={handleQuickCreate}
          initialDate={selectedCalendarDate}
        />;
      case 'create':
        return <CreateEvent eventToEdit={eventToEdit} onEventSaved={handleEventSaved} initialDate={selectedCalendarDate} />;
      case 'worldmap':
        return <WorldMap />;
      case 'freetime':
        return <FreeTimeFinderV2 />;
      case 'profile':
        return <Profile />;
      default:
        return <CalendarView
          onEditEvent={handleEditEvent}
          onSelectedDateChange={handleCalendarDateChange}
          onQuickCreate={handleQuickCreate}
          initialDate={selectedCalendarDate}
        />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={<TabFallback />}>
        {renderContent()}
      </Suspense>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default Index;
