import { describe, it, expect } from 'vitest';
import { parseCalendarOCR } from './calendarOCR';

describe('Calendar OCR Parser', () => {
  describe('parseCalendarOCR', () => {
    it('should parse German calendar format (München example with UI noise)', () => {
      // Simulating OCR output with status bar and UI elements
      const ocrText = `
        23:46
        Dezember
        Bearbeiten
        München
        Ganztägig von Mi. 17. Dez. 2025 bis Fr. 19. Dez. 2025
        Kalender Privat
        Hinweis Ohne
      `;

      const result = parseCalendarOCR(ocrText);

      expect(result).toBeTruthy();
      expect(result?.title).toBe('München');
      expect(result?.isAllDay).toBe(true);
      expect(result?.startDate).toBe('2025-12-17');
      expect(result?.endDate).toBe('2025-12-19');
      expect(result?.calendar).toBe('Privat');
    });

    it('should parse German calendar format (clean München example)', () => {
      const ocrText = `
        München
        Ganztägig von Mi. 17. Dez. 2025 bis Fr. 19. Dez. 2025
        Kalender Privat
        Hinweis Ohne
      `;

      const result = parseCalendarOCR(ocrText);

      expect(result).toBeTruthy();
      expect(result?.title).toBe('München');
      expect(result?.isAllDay).toBe(true);
      expect(result?.startDate).toBe('2025-12-17');
      expect(result?.endDate).toBe('2025-12-19');
      expect(result?.calendar).toBe('Privat');
    });

    it('should parse single day all-day event', () => {
      const ocrText = `
        Team Meeting
        Ganztägig am Mo. 1. Jan. 2025
        Kalender Work
      `;

      const result = parseCalendarOCR(ocrText);

      expect(result).toBeTruthy();
      expect(result?.title).toBe('Team Meeting');
      expect(result?.isAllDay).toBe(true);
      expect(result?.startDate).toBe('2025-01-01');
      expect(result?.endDate).toBe('2025-01-01');
    });

    it('should parse event with time', () => {
      const ocrText = `
        Project Review
        Mo. 15. Jan. 2025
        10:00 - 11:30 Uhr
        Ort: Conference Room A
      `;

      const result = parseCalendarOCR(ocrText);

      expect(result).toBeTruthy();
      expect(result?.title).toBe('Project Review');
      expect(result?.isAllDay).toBe(false);
      expect(result?.startDate).toBe('2025-01-15');
      expect(result?.startTime).toBe('10:00');
      expect(result?.endTime).toBe('11:30');
      expect(result?.location).toBe('Conference Room A');
    });

    it('should parse all German months correctly', () => {
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
        const ocrText = `Event\nGanztägig am ${text}`;
        const result = parseCalendarOCR(ocrText);
        expect(result?.startDate).toBe(expected);
      });
    });

    it('should extract location', () => {
      const ocrText = `
        Conference
        15. Dez. 2025
        Ort: Berlin Convention Center
      `;

      const result = parseCalendarOCR(ocrText);
      expect(result?.location).toBe('Berlin Convention Center');
    });

    it('should extract URL', () => {
      const ocrText = `
        Online Meeting
        20. Dez. 2025
        https://meet.google.com/abc-defg-hij
      `;

      const result = parseCalendarOCR(ocrText);
      expect(result?.url).toBe('https://meet.google.com/abc-defg-hij');
    });

    it('should detect tentative status', () => {
      const ocrText = `
        Maybe Dinner
        25. Dez. 2025
        Tentative
      `;

      const result = parseCalendarOCR(ocrText);
      expect(result?.isTentative).toBe(true);
    });

    it('should handle English date format', () => {
      const ocrText = `
        Birthday Party
        All-day on 31/12/2025
      `;

      const result = parseCalendarOCR(ocrText);
      expect(result?.isAllDay).toBe(true);
      expect(result?.startDate).toBe('2025-12-31');
    });

    it('should skip calendar UI elements', () => {
      const ocrText = `
        Dezember
        Bearbeiten
        Wichtiges Meeting
        Ganztägig am 15. Dez. 2025
      `;

      const result = parseCalendarOCR(ocrText);
      expect(result?.title).toBe('Wichtiges Meeting');
      expect(result?.title).not.toContain('Dezember');
      expect(result?.title).not.toContain('Bearbeiten');
    });

    it('should return null for invalid text', () => {
      const ocrText = 'Random text without any dates or structure';
      const result = parseCalendarOCR(ocrText);
      expect(result).toBeNull();
    });

    it('should parse German calendar format (München example with navigation and UI)', () => {
      // Simulating actual OCR output from iOS with navigation buttons
      const ocrText = `
        23:46
        < Dezember
        Bearbeiten
        München
        Ganztägig von Mi. 17. Dez. 2025 bis Fr. 19. Dez. 2025
        Kalender Privat
        Hinweis Ohne
      `;

      const result = parseCalendarOCR(ocrText);

      expect(result).toBeTruthy();
      expect(result?.title).toBe('München');
      expect(result?.isAllDay).toBe(true);
      expect(result?.startDate).toBe('2025-12-17');
      expect(result?.endDate).toBe('2025-12-19');
    });

    it('should handle title with navigation arrows', () => {
      const ocrText = `
        < December
        Edit
        Team Meeting
        All-day on 15 Dec. 2025
      `;

      const result = parseCalendarOCR(ocrText);

      expect(result).toBeTruthy();
      expect(result?.title).toBe('Team Meeting');
      expect(result?.isAllDay).toBe(true);
    });
  });
});