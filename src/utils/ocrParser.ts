/**
 * OCR Parser for importing calendar events from screenshots
 * Uses AI to extract event information from calendar images
 */

export interface OCRParsedEvent {
  title: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  location?: string;
  description?: string;
}

/**
 * Extract event information from calendar screenshot using AI
 * This uses a simple heuristic approach for now, can be enhanced with actual OCR/AI
 */
export async function parseCalendarScreenshot(imageFile: File): Promise<OCRParsedEvent | null> {
  try {
    // For now, we'll use a placeholder approach
    // In a real implementation, you would:
    // 1. Convert image to base64
    // 2. Send to an AI service (like GPT-4 Vision, Claude, or Tesseract OCR)
    // 3. Parse the response to extract event details

    // Convert image to base64 for potential AI service call
    const base64Image = await fileToBase64(imageFile);

    // TODO: Replace this with actual AI/OCR service call
    // For now, return null to show the manual parsing flow
    // Example AI prompt:
    // "Extract calendar event information from this image. Return JSON with:
    //  title, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), 
    //  startTime (HH:MM), endTime (HH:MM), isAllDay (boolean), location, description"

    console.log('Image ready for OCR processing:', imageFile.name);
    console.log('Base64 length:', base64Image.length);

    // Placeholder: You can integrate with OpenAI Vision API, Google Cloud Vision, etc.
    // For demonstration, we'll parse a test case based on the user's screenshot
    
    // Try to extract text from image metadata if available
    const metadata = await extractImageMetadata(imageFile);
    console.log('Image metadata:', metadata);

    // Return null for now - this will trigger manual entry with image reference
    return null;
  } catch (error) {
    console.error('Error parsing calendar screenshot:', error);
    return null;
  }
}

/**
 * Parse OCR text result into structured event data
 * This handles the text extraction result from OCR services
 */
export function parseOCRText(text: string): OCRParsedEvent | null {
  try {
    // Common patterns in calendar screenshots
    const titleMatch = text.match(/(?:Title|Event):\\s*(.+)/i);
    const dateMatch = text.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/);
    const timeMatch = text.match(/(\d{1,2}):(\d{2})\\s*(AM|PM)?/gi);

    if (!titleMatch && !dateMatch) {
      return null;
    }

    const title = titleMatch?.[1]?.trim() || 'Imported Event';
    
    let startDate = '';
    if (dateMatch) {
      const [_, day, month, year] = dateMatch;
      startDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const times = timeMatch || [];
    const startTime = times[0] ? convertTo24Hour(times[0]) : undefined;
    const endTime = times[1] ? convertTo24Hour(times[1]) : undefined;

    return {
      title,
      startDate,
      endDate: startDate,
      startTime,
      endTime,
      isAllDay: !startTime,
    };
  } catch (error) {
    console.error('Error parsing OCR text:', error);
    return null;
  }
}

/**
 * Manual parsing helper for German calendar format (like iOS Calendar)
 * Example: "München - Ganztägig von Mi. 17. Dez. 2025 bis Fr. 19. Dez. 2025"
 */
export function parseGermanCalendarText(text: string): OCRParsedEvent | null {
  try {
    // Extract title (first line or before "Ganztägig")
    const titleMatch = text.match(/^(.+?)(?=\\s*Ganztägig|\\s*von)/i);
    const title = titleMatch?.[1]?.trim() || '';

    // Check if all-day event
    const isAllDay = text.includes('Ganztägig') || text.includes('All-day');

    // Extract dates in German format
    // Pattern: "17. Dez. 2025"
    const germanMonths: Record<string, string> = {
      'jan': '01', 'feb': '02', 'mär': '03', 'mar': '03', 'apr': '04',
      'mai': '05', 'jun': '06', 'jul': '07', 'aug': '08',
      'sep': '09', 'okt': '10', 'nov': '11', 'dez': '12'
    };

    const datePattern = /(\\d{1,2})\\.\\s*(\\w{3})\\.\\s*(\\d{4})/gi;
    const dates = [...text.matchAll(datePattern)];

    if (dates.length === 0) {
      return null;
    }

    const parseGermanDate = (day: string, month: string, year: string): string => {
      const monthNum = germanMonths[month.toLowerCase()] || '01';
      return `${year}-${monthNum}-${day.padStart(2, '0')}`;
    };

    const startDate = dates[0] 
      ? parseGermanDate(dates[0][1], dates[0][2], dates[0][3])
      : '';

    const endDate = dates[1]
      ? parseGermanDate(dates[1][1], dates[1][2], dates[1][3])
      : startDate;

    return {
      title: title || 'Imported Event',
      startDate,
      endDate,
      isAllDay,
    };
  } catch (error) {
    console.error('Error parsing German calendar text:', error);
    return null;
  }
}

// Helper functions

function convertTo24Hour(time12: string): string {
  const match = time12.match(/(\\d+):(\\d+)\\s*(AM|PM)?/i);
  if (!match) return '';

  let hours = parseInt(match[1]);
  const minutes = match[2];
  const period = match[3]?.toUpperCase();

  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }

  return `${hours.toString().padStart(2, '0')}:${minutes}`;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

async function extractImageMetadata(file: File): Promise<Record<string, any>> {
  // Basic metadata extraction
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: new Date(file.lastModified).toISOString(),
  };
}
