import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('browser-image-compression', () => ({
    default: vi.fn(async (file: File) => new File([file], file.name, { type: 'image/webp' })),
}));

import imageCompression from 'browser-image-compression';
import {
    assertMoodBoardImageFile,
    prepareMoodBoardImage,
    MAX_SOURCE_IMAGE_BYTES,
} from './imageCompression';

function makeFile(name: string, type: string, size = 1024): File {
    const file = new File(['x'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
}

describe('mood board image preparation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('accepts JPEG, PNG and WebP input', () => {
        expect(() => assertMoodBoardImageFile(makeFile('a.jpg', 'image/jpeg'))).not.toThrow();
        expect(() => assertMoodBoardImageFile(makeFile('b.png', 'image/png'))).not.toThrow();
        expect(() => assertMoodBoardImageFile(makeFile('c.webp', 'image/webp'))).not.toThrow();
    });

    it('rejects unsupported formats', () => {
        expect(() => assertMoodBoardImageFile(makeFile('a.gif', 'image/gif'))).toThrow(/Unsupported/);
        expect(() => assertMoodBoardImageFile(makeFile('a.pdf', 'application/pdf'))).toThrow(/Unsupported/);
    });

    it('rejects files above the size limit', () => {
        expect(() =>
            assertMoodBoardImageFile(makeFile('big.jpg', 'image/jpeg', MAX_SOURCE_IMAGE_BYTES + 1)),
        ).toThrow(/too large/);
    });

    it('produces a full and a preview version', async () => {
        const result = await prepareMoodBoardImage(makeFile('a.jpg', 'image/jpeg'));

        expect(result.full).toBeInstanceOf(Blob);
        expect(result.preview).toBeInstanceOf(Blob);
        expect(imageCompression).toHaveBeenCalledTimes(2);
    });

    it('does not compress invalid files', async () => {
        await expect(prepareMoodBoardImage(makeFile('a.gif', 'image/gif'))).rejects.toThrow(/Unsupported/);
        expect(imageCompression).not.toHaveBeenCalled();
    });
});
