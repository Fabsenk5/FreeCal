import type { NativeRequest, NativeResponse } from './bridgeTypes';
import {
  addEvent,
  ensureCalendarPermission,
  getCalendars,
  getEvents,
  pickCalendar,
} from './calendarNative';

export type Respond = (response: NativeResponse) => void;

/**
 * Handle a message sent by the web app (window.ReactNativeWebView.postMessage).
 * Resolves asynchronously and sends the response back through `respond`,
 * which the caller implements with webview.injectJavaScript.
 */
export async function handleNativeRequest(raw: string, respond: Respond): Promise<void> {
  let request: NativeRequest;
  try {
    request = JSON.parse(raw);
  } catch {
    respond({ id: 0, ok: false, error: 'Invalid bridge message' });
    return;
  }

  const { id, type } = request;

  try {
    switch (type) {
      case 'calendars': {
        const permission = await ensureCalendarPermission();
        if (permission === 'denied') {
          respond({ id, ok: false, error: 'Calendar permission denied' });
          return;
        }
        const data = await getCalendars();
        respond({ id, ok: true, data });
        return;
      }
      case 'events': {
        const permission = await ensureCalendarPermission();
        if (permission === 'denied') {
          respond({ id, ok: false, error: 'Calendar permission denied' });
          return;
        }
        if (!request.calendarIds?.length || !request.start || !request.end) {
          respond({ id, ok: false, error: 'Missing calendarIds/start/end' });
          return;
        }
        const data = await getEvents(request.calendarIds, request.start, request.end);
        respond({ id, ok: true, data });
        return;
      }
      case 'pickCalendar': {
        const permission = await ensureCalendarPermission();
        if (permission === 'denied') {
          respond({ id, ok: false, error: 'Calendar permission denied' });
          return;
        }
        const data = await pickCalendar();
        respond({ id, ok: true, data });
        return;
      }
      case 'writeEvent': {
        const permission = await ensureCalendarPermission();
        if (permission === 'denied') {
          respond({ id, ok: false, error: 'Calendar permission denied' });
          return;
        }
        if (!request.calendarId || !request.event) {
          respond({ id, ok: false, error: 'Missing calendarId/event' });
          return;
        }
        const data = await addEvent(request.calendarId, request.event);
        respond({ id, ok: true, data });
        return;
      }
      default: {
        respond({ id, ok: false, error: `Unknown bridge type: ${type}` });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    respond({ id, ok: false, error: message });
  }
}
