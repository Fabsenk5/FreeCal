import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  className?: string;
}

export function MobileHeader({
  title,
  showBack = false,
  onBack,
  leftAction,
  rightAction,
  className
}: MobileHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-b border-border z-40 flex items-center justify-between px-4',
        className
      )}
      style={{ height: 'var(--mobile-header-height)' }}
    >
      <div className="flex items-center gap-3 flex-1">
        {showBack && (
          <button
            onClick={onBack}
            className="p-1 -ml-1 text-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {leftAction}
        {!leftAction && <h1 className="text-lg font-semibold truncate">{title}</h1>}
        {leftAction && <h1 className="text-lg font-semibold truncate ml-2">{title}</h1>}
      </div>
      {rightAction && <div className="flex-shrink-0">{rightAction}</div>}
    </header>
  );
}
