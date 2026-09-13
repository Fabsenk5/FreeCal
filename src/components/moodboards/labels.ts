import { MoodBoardCategory, MoodBoardRole } from '@/lib/api';

export const MOOD_BOARD_CATEGORY_LABELS: Record<MoodBoardCategory, string> = {
    shopping: 'Shopping',
    interior: 'Interior',
    outfit: 'Outfits',
    other: 'Ideas',
};

export const MOOD_BOARD_ROLE_LABELS: Record<MoodBoardRole, string> = {
    editor: 'Can edit',
    viewer: 'View only',
};

export function formatMoodBoardPrice(price: number | null): string | null {
    if (price === null || price === undefined || Number.isNaN(price)) return null;
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(price);
}
