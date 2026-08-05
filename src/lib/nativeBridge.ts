/**
 * Bridge between the FreeCal web app and the native iOS wrapper app
 * (`native/` — Expo + expo-calendar). The protocol is mirrored in
 * `native/src/bridgeTypes.ts` — keep both files in sync.
 *
 * Communication:
 * - web -> native: `window.ReactNativeWebView.postMessage(JSON.stringify({ id, type, ... }))`
 * - native -> web: injected `window.__freeCalNativeResponse({ id, ok, data?, error? })`
 */

export interface NativeCalendar {
  id: string;
  title: string;
  source?: string;
}

/** RecurrenceRule object as returned by expo-calendar (iOS EKRecurrenceRule). */
export interface NativeRecurrenceRule {
  /** 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' */
  frequency: string;
  interval?: number;
  /** iOS EKWeekday: 1 = Sunday ... 7 = Saturday. weekNumber: 1..53 (or negative for end-based). */
  daysOfTheWeek?: Array<{ dayOfTheWeek: number; weekNumber?: number }>;
  daysOfTheMonth?: number[];
  monthsOfTheYear?: number[];
  endDate?: string;
  occurrence?: number;
}

export interface NativeCalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location?: string | null;
  notes?: string | null;
  url?: string | null;
  status?: string | null;
  recurrenceRule?: NativeRecurrenceRule | null;
  alarms?: Array<{ relativeOffset: number }>;
}

/** Payload for writing a FreeCal event into an iOS calendar. */
export interface NativeWriteEvent {
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  location?: string | null;
  notes?: string | null;
  url?: string | null;
  /** Positive minutes before start; converted to negative relativeOffset. */
  alarmMinutes?: number[];
  /** RRULE string (e.g. 'FREQ=WEEKLY;BYDAY=MO,FR') or null for one-time events. */
  rrule?: string | null;
}

export interface NativeWriteResult {
  ok: boolean;
  id?: string | null;
  error?: string;
}

interface NativeResponse {
  id: number;
  ok: boolean;
  data?: unknown;
  error?: string;
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
    __freeCalNativeResponse?: (response: NativeResponse) => void;
  }
}

let nextMessageId = 1;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

if (typeof window !== 'undefined') {
  window.__freeCalNativeResponse = (response: NativeResponse) => {
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if (response.ok) {
      entry.resolve(response.data);
    } else {
      entry.reject(new Error(response.error || 'Native bridge error'));
    }
  };
}

function send<T>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = nextMessageId++;
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    window.ReactNativeWebView?.postMessage(JSON.stringify({ id, type, ...payload }));
  });
}

/** True when the app runs inside the native iOS wrapper (WebView). */
export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && typeof window.ReactNativeWebView === 'object';
}

export function getNativeCalendars(): Promise<NativeCalendar[]> {
  return send<NativeCalendar[]>('calendars');
}

export function getNativeEvents(
  start: Date,
  end: Date,
  calendarIds: string[]
): Promise<NativeCalendarEvent[]> {
  return send<NativeCalendarEvent[]>('events', {
    start: start.toISOString(),
    end: end.toISOString(),
    calendarIds,
  });
}

/** Present the native calendar picker; resolves null when cancelled. */
export function pickNativeCalendar(): Promise<NativeCalendar | null> {
  return send<NativeCalendar | null>('pickCalendar');
}

export function writeNativeEvent(
  calendarId: string,
  event: NativeWriteEvent
): Promise<NativeWriteResult> {
  return send<NativeWriteResult>('writeEvent', { calendarId, event });
}
