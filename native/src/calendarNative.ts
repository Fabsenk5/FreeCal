import * as Calendar from 'expo-calendar';
import type {
  NativeAlarm,
  NativeCalendar,
  NativeCalendarEvent,
  NativeRecurrenceRule,
  NativeWriteEvent,
} from './bridgeTypes';
import { parseRRULE } from './rrule';

export type PermissionResult = 'granted' | 'denied';

/** Map expo's status enum to a stable string the web side can interpret. */
function mapStatus(status: unknown): string | null {
  if (status == null) return null;
  if (typeof status === 'string') return status.toUpperCase();
  // Numeric EventStatus enum (legacy values): 0 none, 1 confirmed, 2 tentative, 3 canceled.
  const numeric = Number(status);
  switch (numeric) {
    case 1: return 'CONFIRMED';
    case 2: return 'TENTATIVE';
    case 3: return 'CANCELED';
    default: return null;
  }
}

function toISO(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

/** Serialize the native RecurrenceRule into the plain bridge shape. */
function serializeRecurrence(rule: Calendar.RecurrenceRule | null | undefined): NativeRecurrenceRule | null {
  if (!rule) return null;
  const endDate = rule.endDate
    ? toISO(rule.endDate instanceof Date ? rule.endDate : new Date(rule.endDate))
    : undefined;
  return {
    frequency: String(rule.frequency).toUpperCase(),
    interval: rule.interval,
    daysOfTheWeek: rule.daysOfTheWeek,
    daysOfTheMonth: rule.daysOfTheMonth,
    monthsOfTheYear: rule.monthsOfTheYear,
    endDate,
    occurrence: rule.occurrence,
  };
}

function serializeEvent(ev: Calendar.ExpoCalendarEvent): NativeCalendarEvent {
  const alarms: NativeAlarm[] = [];
  for (const alarm of ev.alarms ?? []) {
    if (typeof alarm.relativeOffset === 'number') {
      alarms.push({ relativeOffset: alarm.relativeOffset });
    }
  }
  return {
    id: ev.id,
    calendarId: ev.calendarId,
    title: ev.title,
    startDate: toISO(ev.startDate),
    endDate: toISO(ev.endDate),
    allDay: ev.allDay,
    location: ev.location ?? null,
    notes: ev.notes || null,
    url: ev.url ?? null,
    status: mapStatus(ev.status),
    recurrenceRule: serializeRecurrence(ev.recurrenceRule),
    alarms: alarms.length > 0 ? alarms : undefined,
  };
}

export async function ensureCalendarPermission(): Promise<PermissionResult> {
  const current = await Calendar.getCalendarPermissions();
  if (current.granted) return 'granted';
  if (current.status === 'denied' && !current.canAskAgain) return 'denied';
  const requested = await Calendar.requestCalendarPermissions();
  return requested.granted ? 'granted' : 'denied';
}

export async function getCalendars(): Promise<NativeCalendar[]> {
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  return calendars.map((c) => ({
    id: c.id,
    title: c.title,
    source: c.source?.name ?? '',
  }));
}

export async function getEvents(
  calendarIds: string[],
  startISO: string,
  endISO: string
): Promise<NativeCalendarEvent[]> {
  const events = await Calendar.listEvents(calendarIds, new Date(startISO), new Date(endISO));
  return events.map(serializeEvent);
}

export async function pickCalendar(): Promise<NativeCalendar | null> {
  const selected = await Calendar.presentPicker();
  if (!selected) return null;
  return { id: selected.id, title: selected.title, source: selected.source?.name ?? '' };
}

async function getCalendarById(calendarId: string): Promise<Calendar.ExpoCalendar> {
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const found = calendars.find((c) => c.id === calendarId);
  if (!found) throw new Error('Calendar not found');
  return found;
}

/**
 * Write a FreeCal event into the chosen iOS calendar. Presents the native
 * pre-filled event dialog so the user confirms the creation (action
 * 'saved'/'done'). All-day end dates are shifted +1 day because EventKit
 * endDate is exclusive, matching RFC 5545 semantics.
 */
export async function addEvent(
  calendarId: string,
  event: NativeWriteEvent
): Promise<{ ok: boolean; id?: string | null; error?: string }> {
  try {
    const calendar = await getCalendarById(calendarId);

    const options: Calendar.AddEventWithFormOptions = {
      title: event.title,
      startDate: new Date(event.startDate),
      allDay: !!event.allDay,
      location: event.location ?? undefined,
      notes: event.notes ?? undefined,
      url: event.url ?? undefined,
      alarms: (event.alarmMinutes ?? [])
        .filter((m) => Number.isFinite(m) && m > 0)
        .map((m) => ({ relativeOffset: -m })),
    };

    const end = new Date(event.endDate);
    if (event.allDay) {
      // EventKit all-day endDate is exclusive: add one day.
      end.setUTCDate(end.getUTCDate() + 1);
    }
    options.endDate = end;

    const recurrence = parseRRULE(event.rrule);
    if (recurrence) options.recurrenceRule = recurrence;

    const result = await calendar.addEventWithForm(options);
    if (result.action === 'canceled' || result.action === 'deleted') {
      return { ok: false, error: 'canceled' };
    }
    return { ok: true, id: result.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
