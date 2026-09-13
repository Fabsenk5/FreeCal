import { cn } from '@/lib/utils';

interface InitialAvatarProps {
    name: string;
    color?: string | null;
    className?: string;
}

/** Small colored initial circle (matches the profile page avatar style). */
export function InitialAvatar({ name, color, className }: InitialAvatarProps) {
    return (
        <div
            className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
                className,
            )}
            style={{ backgroundColor: color || 'hsl(217, 91%, 60%)' }}
            title={name}
        >
            {name.charAt(0).toUpperCase()}
        </div>
    );
}
