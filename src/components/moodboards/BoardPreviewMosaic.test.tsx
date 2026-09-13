import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BoardPreviewMosaic } from './BoardPreviewMosaic';

function makeImages(count: number) {
    return Array.from({ length: count }, (_, index) => ({
        id: `image-${index}`,
        url: `https://example.com/${index}.webp`,
    }));
}

describe('BoardPreviewMosaic', () => {
    it('renders a placeholder when there are no images', () => {
        const { container } = render(<BoardPreviewMosaic images={[]} />);
        expect(container.querySelectorAll('img')).toHaveLength(0);
    });

    it('renders a single image full size', () => {
        const { container } = render(<BoardPreviewMosaic images={makeImages(1)} />);
        expect(container.querySelectorAll('img')).toHaveLength(1);
    });

    it('caps the preview at four images', () => {
        const { container } = render(<BoardPreviewMosaic images={makeImages(6)} />);
        expect(container.querySelectorAll('img')).toHaveLength(4);
    });
});
