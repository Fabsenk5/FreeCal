import { MoodBoardPreviewImage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { SafeImage } from './SafeImage';

interface BoardPreviewMosaicProps {
    images: MoodBoardPreviewImage[];
    className?: string;
}

/**
 * 2x2 preview mosaic for the overview tiles (MyCloset photo-grid style):
 * 1 image full, 2 split, 3 with a large left image, 4 in a 2x2 grid.
 */
export function BoardPreviewMosaic({ images, className }: BoardPreviewMosaicProps) {
    const visible = images.slice(0, 4);

    if (visible.length === 0) {
        return (
            <div className={cn('aspect-square w-full rounded-xl bg-muted', className)}>
                <SafeImage src={null} className="h-full w-full rounded-xl" />
            </div>
        );
    }

    if (visible.length === 1) {
        return (
            <div className={cn('aspect-square w-full overflow-hidden rounded-xl bg-muted', className)}>
                <SafeImage src={visible[0].url} className="h-full w-full object-cover" />
            </div>
        );
    }

    if (visible.length === 2) {
        return (
            <div className={cn('grid aspect-square w-full grid-cols-2 gap-0.5 overflow-hidden rounded-xl bg-muted', className)}>
                {visible.map(image => (
                    <SafeImage key={image.id} src={image.url} className="h-full w-full object-cover" />
                ))}
            </div>
        );
    }

    if (visible.length === 3) {
        return (
            <div className={cn('grid aspect-square w-full grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl bg-muted', className)}>
                <SafeImage src={visible[0].url} className="row-span-2 h-full w-full object-cover" />
                <SafeImage src={visible[1].url} className="h-full w-full object-cover" />
                <SafeImage src={visible[2].url} className="h-full w-full object-cover" />
            </div>
        );
    }

    return (
        <div className={cn('grid aspect-square w-full grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl bg-muted', className)}>
            {visible.map(image => (
                <SafeImage key={image.id} src={image.url} className="h-full w-full object-cover" />
            ))}
        </div>
    );
}
