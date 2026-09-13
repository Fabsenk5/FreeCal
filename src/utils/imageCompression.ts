/**
 * Client-side image preparation for mood board uploads.
 *
 * Every upload is downscaled and converted to WebP before it reaches
 * Supabase Storage: a full-size version (max 1600px) and a small preview
 * (max 480px) for the board tiles and overview mosaic. This keeps storage
 * usage and load times low; the private bucket 'board-images' only ever
 * receives WebP/JPEG/PNG objects.
 */
import imageCompression from 'browser-image-compression';

export interface PreparedMoodBoardImage {
    full: File;
    preview: File;
}

/**
 * Accepted input formats. HEIC/HEIF only works when the browser can decode
 * it (Safari); Chrome/Firefox users need to convert first.
 */
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/** Source files above this size are rejected before decoding. */
export const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;

const FULL_MAX_DIMENSION = 1600;
const PREVIEW_MAX_DIMENSION = 480;

export function assertMoodBoardImageFile(file: File): void {
    const type = (file.type || '').toLowerCase();
    if (!ACCEPTED_MIME_TYPES.includes(type)) {
        throw new Error('Unsupported image format. Please use JPEG, PNG, WebP or HEIC.');
    }
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
        throw new Error('Image is too large (max 15 MB).');
    }
}

export async function prepareMoodBoardImage(file: File): Promise<PreparedMoodBoardImage> {
    assertMoodBoardImageFile(file);

    try {
        const [full, preview] = await Promise.all([
            imageCompression(file, {
                maxWidthOrHeight: FULL_MAX_DIMENSION,
                initialQuality: 0.82,
                fileType: 'image/webp',
                useWebWorker: true,
            }),
            imageCompression(file, {
                maxWidthOrHeight: PREVIEW_MAX_DIMENSION,
                initialQuality: 0.75,
                fileType: 'image/webp',
                useWebWorker: true,
            }),
        ]);
        return { full, preview };
    } catch (err) {
        console.error('[MoodBoards] image compression failed:', err);
        throw new Error('Image could not be processed. HEIC images need Safari or a prior conversion.');
    }
}
