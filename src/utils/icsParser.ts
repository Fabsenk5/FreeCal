/**
 * ICS (iCalendar) Parser for importing calendar events
 * Supports parsing iOS calendar exported events
 */

export interface ParsedEvent {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  location?: string;
  url?: string;
  recurrenceRule?: string;
  attendees?: Array<{ name: string; email: string }>;
  alerts?: Array<{ minutes: number; type: string }>;
  timezone?: string;
  originalCalendarId?: string;
  isTentative?: boolean;
  travelTime?: number; // in minutes
}

export function parseICS(icsContent: string): ParsedEvent | null {
  try {
    // Normalize line breaks
    const normalized = icsContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Extract VEVENT block
    const eventMatch = normalized.match(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/);
    if (!eventMatch) {
      console.error('No VEVENT found in ICS');
      return null;
    }

    const eventData = eventMatch[1];
    const lines = eventData.split('\n');
    const properties: Record<string, string[]> = {};

    // Parse properties (handle line folding)
    let currentKey = '';
    let currentValue = '';

    for (const line of lines) {
      if (line.match(/^\s/) && currentKey) {
        // Continuation of previous line
        currentValue += line.substring(1);
      } else {
        if (currentKey) {
          if (!properties[currentKey]) properties[currentKey] = [];
          properties[currentKey].push(currentValue);
        }
        
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const keyPart = line.substring(0, colonIndex).toUpperCase();
        const valuePart = line.substring(colonIndex + 1);
        currentKey = keyPart;
        currentValue = valuePart;
      }
    }

    // Add last property
    if (currentKey && currentValue) {
      if (!properties[currentKey]) properties[currentKey] = [];
      properties[currentKey].push(currentValue);
    }

    // Helper function to get property value
    const getProperty = (key: string): string | undefined => {
      return properties[key]?.[0];
    };

    const getProperties = (key: string): string[] => {
      return properties[key] || [];
    };

    // Parse main properties
    const summary = getProperty('SUMMARY') || '';
    const description = getProperty('DESCRIPTION') || '';
    const location = getProperty('LOCATION') || '';
    const url = getProperty('URL') || '';
    const rrule = getProperty('RRULE') || '';
    const transp = getProperty('TRANSP') || 'OPAQUE';
    const status = getProperty('STATUS') || 'CONFIRMED';

    // Parse dates
    const dtstart = getProperty('DTSTART') || '';
    const dtend = getProperty('DTEND') || '';

    // Check if all-day (has VALUE=DATE)
    const isAllDay = dtstart.includes('VALUE=DATE') || !dtstart.includes('T');

    let startDate = '';
    let startTime = '';
    let endDate = '';
    let endTime = '';

    if (isAllDay) {
      // Format: 20231225
      const startMatch = dtstart.match(/(\d{4})(\d{2})(\d{2})/);
      const endMatch = dtend.match(/(\d{4})(\d{2})(\d{2})/);
      
      if (startMatch) {
        startDate = `${startMatch[1]}-${startMatch[2]}-${startMatch[3]}`;
      }
      if (endMatch) {
        endDate = `${endMatch[1]}-${endMatch[2]}-${endMatch[3]}`;
      }
    } else {
      // Format: 20231225T100000Z or 20231225T100000
      const startMatch = dtstart.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
      const endMatch = dtend.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
      
      if (startMatch) {
        startDate = `${startMatch[1]}-${startMatch[2]}-${startMatch[3]}`;
        startTime = `${startMatch[4]}:${startMatch[5]}`;
      }
      if (endMatch) {
        endDate = `${endMatch[1]}-${endMatch[2]}-${endMatch[3]}`;
        endTime = `${endMatch[4]}:${endMatch[5]}`;
      }
    }

    // Parse attendees
    const attendeeLines = getProperties('ATTENDEE');
    const attendees = attendeeLines.map((line) => {
      const emailMatch = line.match(/mailto:([^;]+)/);
      const nameMatch = line.match(/CN=([^;]+)/);
      return {
        email: emailMatch?.[1] || '',
        name: nameMatch?.[1] || emailMatch?.[1] || '',
      };
    }).filter(a => a.email);

    // Parse alarms (VALARM blocks)
    const alarmMatch = normalized.match(/BEGIN:VALARM([\s\S]*?)END:VALARM/g) || [];
    const alerts = alarmMatch.map((alarm) => {
      const triggerMatch = alarm.match(/TRIGGER:(-?)PT(\d+)([MH])/);
      if (!triggerMatch) return null;

      const sign = triggerMatch[1] === '-' ? -1 : 1;
      let minutes = parseInt(triggerMatch[2]) * sign;
      
      if (triggerMatch[3] === 'H') {
        minutes *= 60;
      }

      return {
        minutes: Math.abs(minutes),
        type: 'DISPLAY',
      };
    }).filter((a): a is { minutes: number; type: string } => a !== null);

    // Parse TRANSP to determine if tentative
    const isTentative = status === 'TENTATIVE';

    // Build parsed event
    const parsedEvent: ParsedEvent = {
      title: summary,
      description: description || undefined,
      location: location || undefined,
      url: url || undefined,
      startDate,
      endDate: endDate || startDate,
      startTime: !isAllDay ? startTime : undefined,
      endTime: !isAllDay ? endTime : undefined,
      isAllDay,
      recurrenceRule: rrule || undefined,
      attendees: attendees.length > 0 ? attendees : undefined,
      alerts: alerts.length > 0 ? alerts : undefined,
      isTentative,
    };

    return parsedEvent;
  } catch (error) {
    console.error('Error parsing ICS:', error);
    return null;
  }
}

/**
 * Parse multiple events from ICS content
 */
export function parseMultipleICS(icsContent: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const eventMatches = icsContent.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) || [];

  for (const eventBlock of eventMatches) {
    const fullICS = icsContent.substring(0, icsContent.indexOf('BEGIN:VEVENT')) + eventBlock;
    const parsed = parseICS(fullICS);
    if (parsed) {
      events.push(parsed);
    }
  }

  return events;
}
