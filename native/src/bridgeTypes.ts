/**
 * Bridge protocol between the FreeCal web app and the native iOS wrapper
 * (expo-calendar). These types are mirrored in the web frontend at
 * `src/lib/nativeBridge.ts` — keep both files in sync when changing the
 * contract.
 *
 * Messages flow both ways:
 * - web -> native: `window.ReactNativeWebView.postMessage(JSON.stringify({ id, type, ... }))`
 * - native -> web: injected JS calling `window.__freeCalNativeResponse({ id, ok, data?, error? })`
 */

export interface NativeCalendar {
  id: string;
  title: string;
  source?: string;
}

export interface NativeAlarm {
  /** Minutes from the event start; negative values fire before the start. */
  relativeOffset: number;
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
  alarms?: NativeAlarm[];
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

export interface NativeResponse {
  id: number;
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface NativeRequest {
  id: number;
  type: 'calendars' | 'events' | 'pickCalendar' | 'writeEvent';
  start?: string;
  end?: string;
  calendarIds?: string[];
  calendarId?: string;
  event?: NativeWriteEvent;
}
