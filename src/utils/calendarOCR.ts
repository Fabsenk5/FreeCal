/**
 * Calendar Screenshot OCR using Tesseract.js
 * Extracts event information from iOS/Android calendar screenshots
 */

import Tesseract from 'tesseract.js';

export interface OCREventData {
  title: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  location?: string;
  description?: string;
  url?: string;
  alerts?: string[];
  attendees?: string[];
  isTentative?: boolean;
  calendar?: string;
}

/**
 * Extract text from image using Tesseract OCR
 */
export async function extractTextFromImage(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    const result = await Tesseract.recognize(imageFile, 'deu+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });

    return result.data.text;
  } catch (error) {
    console.error('OCR error:', error);
    throw new Error('Failed to extract text from image');
  }
}

/**
 * Parse extracted OCR text into structured event data
 */
export function parseCalendarOCR(ocrText: string): OCREventData | null {
  try {
    console.log('Parsing OCR text:', ocrText);

    // Normalize text
    const text = ocrText.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');
    const lines = text.split('\\n').map(l => l.trim()).filter(l => l.length > 0);

    // Extract title (usually first line or before date info)
    let title = '';
    let titleIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip common calendar UI elements
      if (line.match(/^(Dezember|December|Januar|January|Bearbeiten|Edit|Kalender|Calendar)$/i)) {
        continue;
      }
      // Found title
      if (line.length > 0 && !line.match(/\\d{1,2}[.\\/\\-]\\s*\\d{1,2}/)) {
        title = line;
        titleIndex = i;
        break;
      }
    }

    // Check for all-day event indicator
    const isAllDay = text.includes('Ganztägig') || 
                     text.includes('All-day') || 
                     text.includes('den ganzen Tag');

    // Parse German date format: "Mi. 17. Dez. 2025" or "von Mi. 17. Dez. 2025 bis Fr. 19. Dez. 2025"
    const germanDatePattern = /(\\w+\\.)?\\s*(\\d{1,2})\\.\\s*(\\w{3})\\.\\s*(\\d{4})/gi;
    const dateMatches = [...text.matchAll(germanDatePattern)];

    // Parse English date format: "Dec 17, 2025" or "17/12/2025"
    const englishDatePattern = /(\\d{1,2})[.\\/\\-](\\d{1,2})[.\\/\\-](\\d{4})/g;
    const englishMatches = [...text.matchAll(englishDatePattern)];

    let startDate = '';
    let endDate = '';

    if (dateMatches.length > 0) {
      // German format
      const germanMonths: Record<string, string> = {
        'jan': '01', 'feb': '02', 'mär': '03', 'mar': '03', 'apr': '04',
        'mai': '05', 'jun': '06', 'jul': '07', 'aug': '08',
        'sep': '09', 'okt': '10', 'nov': '11', 'dez': '12'
      };

      const parseGermanDate = (day: string, month: string, year: string): string => {
        const monthNum = germanMonths[month.toLowerCase().replace('.', '')] || '01';
        return `${year}-${monthNum}-${day.padStart(2, '0')}`;
      };

      if (dateMatches[0]) {
        startDate = parseGermanDate(dateMatches[0][2], dateMatches[0][3], dateMatches[0][4]);
      }
      if (dateMatches[1]) {
        endDate = parseGermanDate(dateMatches[1][2], dateMatches[1][3], dateMatches[1][4]);
      }
    } else if (englishMatches.length > 0) {
      // English format: DD/MM/YYYY or MM/DD/YYYY
      const parseEnglishDate = (day: string, month: string, year: string): string => {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      };

      if (englishMatches[0]) {
        startDate = parseEnglishDate(englishMatches[0][1], englishMatches[0][2], englishMatches[0][3]);
      }
      if (englishMatches[1]) {
        endDate = parseEnglishDate(englishMatches[1][1], englishMatches[1][2], englishMatches[1][3]);
      }
    }

    // If no end date found, use start date
    if (!endDate && startDate) {
      endDate = startDate;
    }

    // Parse time (HH:MM format)
    const timePattern = /(\\d{1,2}):(\\d{2})\\s*(Uhr|AM|PM)?/gi;
    const timeMatches = [...text.matchAll(timePattern)];

    let startTime: string | undefined;
    let endTime: string | undefined;

    if (!isAllDay && timeMatches.length > 0) {
      const formatTime = (hours: string, minutes: string, period?: string): string => {
        let h = parseInt(hours);
        if (period?.toUpperCase() === 'PM' && h !== 12) h += 12;
        if (period?.toUpperCase() === 'AM' && h === 12) h = 0;
        return `${h.toString().padStart(2, '0')}:${minutes}`;
      };

      if (timeMatches[0]) {
        startTime = formatTime(timeMatches[0][1], timeMatches[0][2], timeMatches[0][3]);
      }
      if (timeMatches[1]) {
        endTime = formatTime(timeMatches[1][1], timeMatches[1][2], timeMatches[1][3]);
      }
    }

    // Extract location
    let location: string | undefined;
    const locationKeywords = ['Ort:', 'Location:', 'Raum:', 'Room:'];
    for (const line of lines) {
      for (const keyword of locationKeywords) {
        if (line.includes(keyword)) {
          location = line.replace(keyword, '').trim();
          break;
        }
      }
    }

    // Extract notes/description
    let description: string | undefined;
    const notesKeywords = ['Hinweis:', 'Notes:', 'Notizen:', 'Bemerkung:'];
    for (let i = 0; i < lines.length; i++) {
      for (const keyword of notesKeywords) {
        if (lines[i].includes(keyword)) {
          description = lines.slice(i + 1).join(' ').trim();
          break;
        }
      }
    }

    // Extract calendar name
    let calendar: string | undefined;
    const calendarPattern = /Kalender.*?(Privat|Private|Work|Arbeit|Personal)/i;
    const calMatch = text.match(calendarPattern);
    if (calMatch) {
      calendar = calMatch[1];
    }

    // Extract URL
    let url: string | undefined;
    const urlPattern = /(https?:\\/\\/[^\\s]+)/;
    const urlMatch = text.match(urlPattern);
    if (urlMatch) {
      url = urlMatch[1];
    }

    // Check for tentative status
    const isTentative = text.includes('tentativ') || 
                       text.includes('Tentative') ||
                       text.includes('vielleicht');

    // Validate we have at least title and date
    if (!title && !startDate) {
      return null;
    }

    return {
      title: title || 'Imported Event',
      startDate,
      endDate: endDate || startDate,
      startTime,
      endTime,
      isAllDay,
      location,
      description,
      url,
      calendar,
      isTentative,
    };
  } catch (error) {
    console.error('Error parsing OCR text:', error);
    return null;
  }
}

/**
 * Process calendar screenshot: OCR + Parse
 */
export async function processCalendarScreenshot(
  imageFile: File,
  onProgress?: (progress: number) => void
): Promise<OCREventData | null> {
  try {
    // Step 1: Extract text using OCR (0-80%)
    const text = await extractTextFromImage(imageFile, (p) => {
      onProgress?.(Math.round(p * 0.8));
    });

    // Step 2: Parse the text (80-100%)
    onProgress?.(90);
    const eventData = parseCalendarOCR(text);
    onProgress?.(100);

    return eventData;
  } catch (error) {
    console.error('Error processing screenshot:', error);
    throw error;
  }
}
