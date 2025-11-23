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
    const text = ocrText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // FIRST: Extract location (before processing title)
    let location: string | undefined;
    const locationKeywords = ['Ort:', 'Location:', 'Raum:', 'Room:'];
    const locationLineIndices: number[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for location with keyword
      for (const keyword of locationKeywords) {
        if (line.includes(keyword)) {
          location = line.replace(keyword, '').trim();
          locationLineIndices.push(i);
          break;
        }
      }
      
      // Check for location with domain prefix (e.g., "calovo.de | Arena...")
      if (!location && line.match(/\.(de|com|org|net)\s*\|/)) {
        // Extract everything after the domain
        const parts = line.split('|');
        if (parts.length > 1) {
          location = parts.slice(1).join('|').trim();
          locationLineIndices.push(i);
        }
      }
      
      // Check for venue patterns (Arena, Stadium, etc.)
      if (!location && line.match(/(Arena|Stadium|Stadion|Halle|Hall|Center|Centre|Platz)/i)) {
        // Check if it looks like a standalone location line
        if (!line.match(/^(Hannover 96|FC |SC |TSV |SV )/i)) {
          location = line;
          locationLineIndices.push(i);
        }
      }
    }

    // Extract title - support multi-line titles but exclude location lines
    let titleLines: string[] = [];
    let titleStartIndex = -1;
    let titleEndIndex = -1;
    
    // Common iOS calendar UI elements to skip (more comprehensive)
    const skipPatterns = [
      /^\d{1,2}:\d{2}/, // Time in HH:MM format (status bar)
      /^</, // Back button arrow
      /^[<>◀▶←→]+/, // Navigation arrows
      /^(Dezember|December|Januar|January|Februar|February|März|March|April|Mai|May|Juni|June|Juli|July|August|September|Oktober|October|November)\b/i, // Month names
      /^(Bearbeiten|Edit|Kalender|Calendar|Hinweis|Notes|Note|Notizen|Ort|Location|URL)$/i, // UI field labels (exact match)
      /^(Privat|Private|Work|Arbeit|Ohne|None)$/i, // Calendar names
      /^[📅🔔⏰]+$/, // Emoji icons
      /^\d{1,2}%$/, // Battery percentage
      /^(von|bis|from|to|am)$/i, // Prepositions alone
      /^(Ereignis löschen|Delete Event|Abbrechen|Cancel|Kalenderabo beenden|Mehr anzeigen)$/i, // Action buttons
      /^\d{2}:\d{2}$/, // Time only (18:00, 19:00, etc. in timeline)
    ];
    
    // Find title by looking for consecutive lines of meaningful text before date/time info
    let inTitleSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip location lines
      if (locationLineIndices.includes(i)) {
        if (inTitleSection) {
          titleEndIndex = i - 1;
          break;
        }
        continue;
      }
      
      // Check if we've hit the date/time line (including multi-day "von...bis" pattern)
      if (line.match(/^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i) ||
          line.match(/^von\s+\d{1,2}:\d{2}/i) || // Multi-day pattern: "von 19:00 Mo..."
          line.match(/^\d{1,2}\.\s*(Jan|Feb|Mär|Mar|Apr|Mai|May|Jun|Jul|Aug|Sep|Okt|Oct|Nov|Dez|Dec)/i) ||
          line.match(/^\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}/) || // Time range
          line.match(/^(Ganztägig|All-day)/i)) {
        titleEndIndex = i - 1;
        break;
      }
      
      // Skip obvious UI elements
      if (skipPatterns.some(pattern => pattern.test(line))) {
        if (inTitleSection) {
          titleEndIndex = i - 1;
          break;
        }
        continue;
      }
      
      // Skip lines with domain patterns (location lines)
      if (line.match(/\.(de|com|org|net)\s*\|/)) {
        if (inTitleSection) {
          titleEndIndex = i - 1;
          break;
        }
        continue;
      }
      
      // Skip lines with special chars that indicate UI
      if (line.match(/^[<>◀▶←→•⋅]+/)) {
        continue;
      }
      
      // Check if line is reasonable title text
      if (line.length >= 2 && line.length <= 200 && line.match(/[a-zA-ZäöüÄÖÜß0-9]/)) {
        if (!inTitleSection) {
          titleStartIndex = i;
          inTitleSection = true;
        }
        titleLines.push(line.replace(/^[<>◀▶←→\s]+/, '').trim());
      } else if (inTitleSection) {
        titleEndIndex = i - 1;
        break;
      }
    }
    
    // Join multi-line title
    const title = titleLines.join(' ').trim() || 'Imported Event';

    // Check for all-day event indicator
    const isAllDay = text.includes('Ganztägig') || 
                     text.includes('All-day') || 
                     text.includes('den ganzen Tag');

    // Parse time ranges - handle both single-day and multi-day formats
    let startTime: string | undefined;
    let endTime: string | undefined;
    
    if (!isAllDay) {
      // First, try multi-day pattern: "von HH:MM Mo. DD. Mon. YYYY bis HH:MM Di. DD. Mon. YYYY"
      const multiDayPattern = /von\s+(\d{1,2}):(\d{2}).*?bis\s+(\d{1,2}):(\d{2})/i;
      const multiDayMatch = text.match(multiDayPattern);
      
      if (multiDayMatch) {
        startTime = `${multiDayMatch[1].padStart(2, '0')}:${multiDayMatch[2]}`;
        endTime = `${multiDayMatch[3].padStart(2, '0')}:${multiDayMatch[4]}`;
      } else {
        // Fall back to single-day time range: "18:30 - 20:30"
        const timeRangePattern = /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/;
        
        for (const line of lines) {
          // Skip status bar time (at start of text)
          if (lines.indexOf(line) === 0 && line.match(/^\d{2}:\d{2}/)) {
            continue;
          }
          
          const match = line.match(timeRangePattern);
          if (match) {
            startTime = `${match[1].padStart(2, '0')}:${match[2]}`;
            endTime = `${match[3].padStart(2, '0')}:${match[4]}`;
            break;
          }
        }
      }
    }

    // Parse German date format: "Mi. 17. Dez. 2025" or "28. Nov. 2025"
    const germanDatePattern = /(\w+\.)?\s*(\d{1,2})\.\s*(\w{3})\.\s*(\d{4})/gi;
    const dateMatches = [...text.matchAll(germanDatePattern)];

    // Parse English date format: "Dec 17, 2025" or "17/12/2025"
    const englishDatePattern = /(\d{1,2})[\./\-](\d{1,2})[\./\-](\d{4})/g;
    const englishMatches = [...text.matchAll(englishDatePattern)];

    // The rest of the original code continues here unchanged
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
    const urlPattern = /(https?:\/\/[^\s]+)/;
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