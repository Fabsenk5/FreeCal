import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SafeImageProps {
    src?: string | null;
    alt?: string;
    className?: string;
}

/**
 * Image with a graceful fallback: signed URLs can expire or fail to load,
 * in which case we show a muted placeholder instead of a broken icon.
 */
export function SafeImage({ src, alt = '', className }: SafeImageProps) {
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setFailed(false);
    }, [src]);

    if (!src || failed) {
        return (
            <div className={cn('flex items-center justify-center bg-muted', className)}>
                <ImageOff className="h-5 w-5 text-muted-foreground/40" />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setFailed(true)}
            className={className}
        />
    );
}
