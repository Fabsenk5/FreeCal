/**
 * Tests for the pure participant-diff logic used by updateEvent (R2).
 *
 * computeParticipantDiff is a pure function, so no Supabase mocking is
 * needed. The module is imported dynamically after stubbing the env vars
 * that src/lib/supabase.ts requires at import time.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

let computeParticipantDiff: (typeof import('./api'))['computeParticipantDiff'];

beforeAll(async () => {
    ({ computeParticipantDiff } = await import('./api'));
});

describe('computeParticipantDiff', () => {
    it('inserts only newly added participants', () => {
        const diff = computeParticipantDiff(['a', 'b'], ['a', 'b', 'c']);
        expect(diff.toInsert).toEqual(['c']);
        expect(diff.toDelete).toEqual([]);
        expect(diff.toKeep).toEqual(['a', 'b']);
    });

    it('deletes only removed participants', () => {
        const diff = computeParticipantDiff(['a', 'b', 'c'], ['a']);
        expect(diff.toInsert).toEqual([]);
        expect(diff.toDelete).toEqual(['b', 'c']);
        expect(diff.toKeep).toEqual(['a']);
    });

    it('leaves unchanged participants untouched (preserves RSVP status)', () => {
        const diff = computeParticipantDiff(['a', 'b'], ['b', 'a']);
        expect(diff.toInsert).toEqual([]);
        expect(diff.toDelete).toEqual([]);
        expect(diff.toKeep).toEqual(['a', 'b']);
    });

    it('handles an empty desired list (remove all)', () => {
        const diff = computeParticipantDiff(['a', 'b'], []);
        expect(diff.toInsert).toEqual([]);
        expect(diff.toDelete).toEqual(['a', 'b']);
        expect(diff.toKeep).toEqual([]);
    });

    it('handles an empty existing list (insert all)', () => {
        const diff = computeParticipantDiff([], ['a', 'b']);
        expect(diff.toInsert).toEqual(['a', 'b']);
        expect(diff.toDelete).toEqual([]);
        expect(diff.toKeep).toEqual([]);
    });

    it('handles both lists empty', () => {
        const diff = computeParticipantDiff([], []);
        expect(diff.toInsert).toEqual([]);
        expect(diff.toDelete).toEqual([]);
        expect(diff.toKeep).toEqual([]);
    });

    it('dedupes duplicate ids in the desired list', () => {
        const diff = computeParticipantDiff([], ['a', 'a', 'b']);
        expect(diff.toInsert).toEqual(['a', 'b']);
    });

    it('does not re-insert ids that already exist (kept rows win)', () => {
        const diff = computeParticipantDiff(['a'], ['a', 'a', 'b']);
        expect(diff.toInsert).toEqual(['b']);
        expect(diff.toDelete).toEqual([]);
        expect(diff.toKeep).toEqual(['a']);
    });
});
