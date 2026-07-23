import { describe, it, expect } from 'vitest';
import { eventBlocksUser, isSpecialEvent } from './freeTimeFinderUtils';
import type { EventWithAttendees } from '@/lib/api';

const makeEvent = (overrides: Record<string, unknown>): EventWithAttendees =>
  ({
    user_id: 'owner-id',
    attendees: [],
    viewers: [],
    ...overrides,
  }) as EventWithAttendees;

describe('eventBlocksUser', () => {
  it('blocks the event owner', () => {
    expect(eventBlocksUser(makeEvent({}), 'owner-id')).toBe(true);
  });

  it('does not block an unrelated user', () => {
    expect(eventBlocksUser(makeEvent({}), 'other-id')).toBe(false);
  });

  it('never blocks viewers', () => {
    const event = makeEvent({ viewers: ['viewer-id'] });
    expect(eventBlocksUser(event, 'viewer-id')).toBe(false);
  });

  it('treats plain string attendees without status as accepted', () => {
    const event = makeEvent({ attendees: ['user-a'] });
    expect(eventBlocksUser(event, 'user-a')).toBe(true);
  });

  it('uses attendees_details status for plain string attendees', () => {
    const event = makeEvent({
      attendees: ['user-a', 'user-b', 'user-c'],
      attendees_details: [
        { userId: 'user-a', status: 'accepted' },
        { userId: 'user-b', status: 'pending' },
        { userId: 'user-c', status: 'declined' },
      ],
    });
    expect(eventBlocksUser(event, 'user-a')).toBe(true);
    expect(eventBlocksUser(event, 'user-b')).toBe(false);
    expect(eventBlocksUser(event, 'user-c')).toBe(false);
  });

  it('blocks object attendees with status accepted', () => {
    const event = makeEvent({ attendees: [{ user_id: 'user-a', status: 'accepted' }] });
    expect(eventBlocksUser(event, 'user-a')).toBe(true);
  });

  it('does not block object attendees with status pending or declined', () => {
    const event = makeEvent({
      attendees: [
        { user_id: 'user-a', status: 'pending' },
        { user_id: 'user-b', status: 'declined' },
      ],
    });
    expect(eventBlocksUser(event, 'user-a')).toBe(false);
    expect(eventBlocksUser(event, 'user-b')).toBe(false);
  });

  it('treats object attendees without status as accepted (id or user_id key)', () => {
    const event = makeEvent({ attendees: [{ id: 'user-a' }, { user_id: 'user-b' }] });
    expect(eventBlocksUser(event, 'user-a')).toBe(true);
    expect(eventBlocksUser(event, 'user-b')).toBe(true);
  });

  it('handles a null attendees array', () => {
    const event = makeEvent({ attendees: null });
    expect(eventBlocksUser(event, 'user-a')).toBe(false);
  });
});

describe('isSpecialEvent', () => {
  it('detects injected system events', () => {
    expect(isSpecialEvent(makeEvent({ user_id: 'system' }))).toBe(true);
  });

  it('detects birthday/valentine flags', () => {
    expect(isSpecialEvent(makeEvent({ isBirthdayEvent: true }))).toBe(true);
    expect(isSpecialEvent(makeEvent({ isValentineEvent: true }))).toBe(true);
  });

  it('returns false for regular events', () => {
    expect(isSpecialEvent(makeEvent({}))).toBe(false);
  });
});
