import { describe, it, expect } from 'vitest';
import { parseGermanCalendarText, parseOCRText } from './ocrParser';

describe('OCR Parser', () => {
  describe('parseGermanCalendarText', () => {
    it('should parse German calendar format correctly', () => {
      const text = 'München\nGanztägig von Mi. 17. Dez. 2025 bis Fr. 19. Dez. 2025';
      const result = parseGermanCalendarText(text);

      expect(result).toBeTruthy();
      expect(result?.title).toBe('München');
      expect(result?.isAllDay).toBe(true);
      expect(result?.startDate).toBe('2025-12-17');
      expect(result?.endDate).toBe('2025-12-19');
    });

    it('should handle single day events', () => {
      const text = 'Meeting\nGanztägig am Mi. 17. Dez. 2025';
      const result = parseGermanCalendarText(text);

      expect(result).toBeTruthy();
      expect(result?.title).toBe('Meeting');
      expect(result?.isAllDay).toBe(true);
      expect(result?.startDate).toBe('2025-12-17');
    });

    it('should parse all German month abbreviations', () => {
      const months = [
        { text: '1. Jan. 2025', expected: '2025-01-01' },
        { text: '15. Feb. 2025', expected: '2025-02-15' },
        { text: '20. Mär. 2025', expected: '2025-03-20' },
        { text: '10. Apr. 2025', expected: '2025-04-10' },
        { text: '5. Mai. 2025', expected: '2025-05-05' },
        { text: '30. Jun. 2025', expected: '2025-06-30' },
        { text: '4. Jul. 2025', expected: '2025-07-04' },
        { text: '15. Aug. 2025', expected: '2025-08-15' },
        { text: '1. Sep. 2025', expected: '2025-09-01' },
        { text: '31. Okt. 2025', expected: '2025-10-31' },
        { text: '11. Nov. 2025', expected: '2025-11-11' },
        { text: '25. Dez. 2025', expected: '2025-12-25' },
      ];

      months.forEach(({ text, expected }) => {
        const result = parseGermanCalendarText(`Event\nGanztägig am ${text}`);
        expect(result?.startDate).toBe(expected);
      });
    });
  });

  describe('parseOCRText', () => {
    it('should parse basic event text', () => {
      const text = 'Title: Team Meeting\n15/12/2024\n10:00 AM - 11:00 AM';
      const result = parseOCRText(text);

      expect(result).toBeTruthy();
      expect(result?.title).toBe('Team Meeting');
      expect(result?.startDate).toBe('2024-12-15');
    });

    it('should handle dates in different formats', () => {
      const formats = [
        '15/12/2024',
        '15-12-2024',
        '15.12.2024',
      ];

      formats.forEach((dateStr) => {
        const text = `Event: Test\n${dateStr}`;
        const result = parseOCRText(text);
        expect(result?.startDate).toBe('2024-12-15');
      });
    });

    it('should detect all-day events', () => {
      const text = 'Title: Conference\n15/12/2024';
      const result = parseOCRText(text);

      expect(result).toBeTruthy();
      expect(result?.isAllDay).toBe(true);
      expect(result?.startTime).toBeUndefined();
    });

    it('should parse time ranges', () => {
      const text = 'Meeting\n15/12/2024\n9:00 AM - 5:00 PM';
      const result = parseOCRText(text);

      expect(result).toBeTruthy();
      expect(result?.isAllDay).toBe(false);
      expect(result?.startTime).toBeTruthy();
      expect(result?.endTime).toBeTruthy();
    });
  });
});
