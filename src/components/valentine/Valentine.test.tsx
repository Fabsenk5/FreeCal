import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useValentineEvent } from '../../hooks/useValentineEvent';
import { ValentineProvider } from '../../contexts/ValentineContext';
import React from 'react';

// Mock Supabase to avoid initialization errors in context if any
vi.mock('@/lib/supabase', () => ({
    supabase: {
        auth: {
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
        },
    },
}));

describe('useValentineEvent', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should inject valentine event when it is Valentine mode (Feb 14)', () => {
        // Set date to Feb 14, 2026 10 AM
        vi.setSystemTime(new Date('2026-02-14T10:00:00+01:00'));

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <ValentineProvider>{children}</ValentineProvider>
        );

        const { result } = renderHook(() => useValentineEvent([]), { wrapper });

        expect(result.current).toHaveLength(1);
        expect(result.current[0].title).toContain('Ein besonderer Tag für uns');
        expect(result.current[0].isValentineEvent).toBe(true);
        expect(result.current[0].color).toBe('hsl(350, 80%, 60%)');
    });

    it('should NOT inject valentine event when it is NOT Valentine mode (Jan 1)', () => {
        // Set date to Jan 1, 2026
        vi.setSystemTime(new Date('2026-01-01T10:00:00+01:00'));

        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <ValentineProvider>{children}</ValentineProvider>
        );

        const { result } = renderHook(() => useValentineEvent([]), { wrapper });

        expect(result.current).toHaveLength(0);
    });
});
