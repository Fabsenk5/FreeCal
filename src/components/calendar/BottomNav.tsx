import { Calendar, Plus, Clock, User, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  activeTab: 'calendar' | 'create' | 'worldmap' | 'freetime' | 'profile';
  onTabChange: (tab: 'calendar' | 'create' | 'worldmap' | 'freetime' | 'profile') => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: 'calendar' as const, label: 'Calendar', icon: Calendar },
    { id: 'create' as const, label: 'Create', icon: Plus },
    { id: 'worldmap' as const, label: 'Map', icon: Globe },
    { id: 'freetime' as const, label: 'Free Time', icon: Clock },
    { id: 'profile' as const, label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50" style={{ height: 'var(--bottom-nav-height)' }}>
      <div className="flex items-center justify-around h-full px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors',
                isActive && 'text-primary',
                !isActive && 'text-muted-foreground'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'scale-110')} style={{ transition: 'var(--transition-smooth)' }} />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
