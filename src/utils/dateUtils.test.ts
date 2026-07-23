import { describe, it, expect } from 'vitest';
import {
  getDaysInMonth,
  getFirstDayOfMonth,
  formatDate,
  formatTime,
  formatDateTime,
  isSameDay,
  isToday,
  getWeekDays,
  getMonthName,
  getCalendarDays,
  addMonths,
  startOfWeek,
  endOfWeek,
  getWeekDates,
} from './dateUtils';

// All fixtures are built from local date components, so the tests are
// independent of the machine timezone.
//
// Some Node/ICU versions render the space before AM/PM as a narrow no-break
// space (U+202F) or no-break space (U+00A0); normalize before comparing.
const normalizeSpaces = (s: string): string => s.replace(/[\u00A0\u202F]/g, ' ');

const expectLocalDate = (date: Date, year: number, month: number, day: number) => {
  expect(date.getFullYear()).toBe(year);
  expect(date.getMonth()).toBe(month);
  expect(date.getDate()).toBe(day);
};

describe('getDaysInMonth', () => {
  it('returns the number of days for 31- and 30-day months', () => {
    expect(getDaysInMonth(2024, 0)).toBe(31); // January
    expect(getDaysInMonth(2024, 3)).toBe(30); // April
    expect(getDaysInMonth(2024, 11)).toBe(31); // December
  });

  it('handles leap years for February', () => {
    expect(getDaysInMonth(2024, 1)).toBe(29); // 2024 is a leap year
    expect(getDaysInMonth(2023, 1)).toBe(28); // 2023 is not
  });

  it('applies the century rules for leap years', () => {
    expect(getDaysInMonth(1900, 1)).toBe(28); // divisible by 100, not by 400
    expect(getDaysInMonth(2000, 1)).toBe(29); // divisible by 400
  });
});

describe('getFirstDayOfMonth', () => {
  it('returns the weekday (0 = Sunday) of the 1st of the month', () => {
    expect(getFirstDayOfMonth(2024, 0)).toBe(1); // Jan 1 2024 was a Monday
    expect(getFirstDayOfMonth(2023, 8)).toBe(5); // Sep 1 2023 was a Friday
    expect(getFirstDayOfMonth(2023, 9)).toBe(0); // Oct 1 2023 was a Sunday
  });
});

describe('formatDate / formatTime / formatDateTime', () => {
  it('formats a date in long en-US form', () => {
    expect(formatDate(new Date(2024, 0, 5, 12))).toBe('January 5, 2024');
    expect(formatDate(new Date(2023, 11, 25, 23, 59))).toBe('December 25, 2023');
  });

  it('formats time in 12-hour form', () => {
    expect(normalizeSpaces(formatTime(new Date(2024, 0, 1, 15, 30)))).toBe('3:30 PM');
    expect(normalizeSpaces(formatTime(new Date(2024, 0, 1, 9, 5)))).toBe('9:05 AM');
  });

  it('formats midnight and noon correctly (12-hour edge cases)', () => {
    expect(normalizeSpaces(formatTime(new Date(2024, 0, 1, 0, 0)))).toBe('12:00 AM');
    expect(normalizeSpaces(formatTime(new Date(2024, 0, 1, 12, 0)))).toBe('12:00 PM');
  });

  it('combines date and time', () => {
    expect(normalizeSpaces(formatDateTime(new Date(2024, 0, 1, 15, 30)))).toBe('January 1, 2024 at 3:30 PM');
  });
});

describe('isSameDay', () => {
  it('ignores the time of day', () => {
    expect(isSameDay(new Date(2024, 0, 15, 0, 0), new Date(2024, 0, 15, 23, 59, 59))).toBe(true);
  });

  it('distinguishes days around midnight', () => {
    expect(isSameDay(new Date(2024, 0, 15, 23, 59, 59), new Date(2024, 0, 16, 0, 0))).toBe(false);
  });

  it('distinguishes same day-of-month in different months and years', () => {
    expect(isSameDay(new Date(2024, 0, 15), new Date(2024, 1, 15))).toBe(false);
    expect(isSameDay(new Date(2024, 0, 15), new Date(2025, 0, 15))).toBe(false);
  });
});

describe('isToday', () => {
  it('is true for now and false for adjacent days', () => {
    expect(isToday(new Date())).toBe(true);

    // setDate arithmetic is wall-clock based and DST-safe.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isToday(yesterday)).toBe(false);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isToday(tomorrow)).toBe(false);
  });
});

describe('getWeekDays / getMonthName', () => {
  it('returns the week day labels starting Monday', () => {
    expect(getWeekDays()).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('returns the month name for 0-based month indexes', () => {
    expect(getMonthName(0)).toBe('January');
    expect(getMonthName(11)).toBe('December');
    for (let month = 0; month < 12; month++) {
      expect(getMonthName(month)).toBeTruthy();
    }
  });
});

describe('getCalendarDays', () => {
  it('produces a Monday-based grid without padding when the month starts on Monday', () => {
    const days = getCalendarDays(2024, 0); // Jan 1 2024 was a Monday
    expect(days.length).toBe(31);
    expect(days.every(d => d !== null)).toBe(true);
    expectLocalDate(days[0] as Date, 2024, 0, 1);
    expectLocalDate(days[30] as Date, 2024, 0, 31);
  });

  it('pads leading nulls for months starting later in the week', () => {
    const days = getCalendarDays(2024, 1); // Feb 1 2024 was a Thursday -> 3 pads (Mon-Wed)
    expect(days.length).toBe(3 + 29); // 2024 is a leap year
    expect(days.slice(0, 3)).toEqual([null, null, null]);
    expectLocalDate(days[3] as Date, 2024, 1, 1);
    expectLocalDate(days[31] as Date, 2024, 1, 29); // leap day is the last cell
  });

  it('pads 6 cells when the 1st falls on a Sunday', () => {
    const days = getCalendarDays(2023, 9); // Oct 1 2023 was a Sunday
    expect(days.length).toBe(6 + 31);
    expect(days.slice(0, 6).every(d => d === null)).toBe(true);
    expectLocalDate(days[6] as Date, 2023, 9, 1);
    expectLocalDate(days[36] as Date, 2023, 9, 31);
  });

  it('returns local-midnight dates of the requested month', () => {
    const days = getCalendarDays(2023, 8); // September 2023
    const firstRealDay = days.find(d => d !== null) as Date;
    expectLocalDate(firstRealDay, 2023, 8, 1);
    expect(firstRealDay.getHours()).toBe(0);
    expect(firstRealDay.getMinutes()).toBe(0);
  });
});

describe('addMonths', () => {
  it('adds and subtracts months, crossing year boundaries', () => {
    expectLocalDate(addMonths(new Date(2024, 0, 15), 1), 2024, 1, 15);
    expectLocalDate(addMonths(new Date(2024, 0, 15), 12), 2025, 0, 15);
    expectLocalDate(addMonths(new Date(2023, 11, 15), 1), 2024, 0, 15);
    expectLocalDate(addMonths(new Date(2024, 0, 15), -1), 2023, 11, 15);
  });

  it('clamps the day to the target month instead of overflowing into the next', () => {
    // Regression: previously Jan 31 + 1 month overflowed to Mar 2/3,
    // skipping February entirely.
    expectLocalDate(addMonths(new Date(2024, 0, 31), 1), 2024, 1, 29); // leap year
    expectLocalDate(addMonths(new Date(2023, 0, 31), 1), 2023, 1, 28); // non-leap year
    expectLocalDate(addMonths(new Date(2024, 2, 31), -1), 2024, 1, 29); // backwards clamp
    expectLocalDate(addMonths(new Date(2024, 4, 31), -1), 2024, 3, 30); // May 31 -> Apr 30
  });

  it('preserves the time of day', () => {
    const result = addMonths(new Date(2024, 0, 31, 15, 30, 45), 1);
    expectLocalDate(result, 2024, 1, 29);
    expect(result.getHours()).toBe(15);
    expect(result.getMinutes()).toBe(30);
    expect(result.getSeconds()).toBe(45);
  });
});

describe('startOfWeek / endOfWeek', () => {
  it('returns Monday 00:00 as the start of the week', () => {
    const start = startOfWeek(new Date(2024, 0, 3, 15, 30)); // Wednesday
    expectLocalDate(start, 2024, 0, 1); // Monday Jan 1 2024
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it('maps Sunday to the Monday of the same (Monday-based) week', () => {
    const start = startOfWeek(new Date(2024, 0, 7, 12)); // Sunday
    expectLocalDate(start, 2024, 0, 1); // previous Monday, not the next one
  });

  it('keeps Monday as the start of its own week', () => {
    expectLocalDate(startOfWeek(new Date(2024, 0, 1, 10)), 2024, 0, 1);
  });

  it('returns Sunday 23:59:59.999 as the end of the week', () => {
    const end = endOfWeek(new Date(2024, 0, 3, 15, 30)); // Wednesday
    expectLocalDate(end, 2024, 0, 7); // Sunday Jan 7 2024
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });

  it('keeps Sunday as the end of its own week', () => {
    expectLocalDate(endOfWeek(new Date(2024, 0, 7, 8)), 2024, 0, 7);
  });

  it('startOfWeek and endOfWeek bracket the same 7-day week', () => {
    // Week of Jun 10-16 2024; no common timezone switches DST that week, so
    // the epoch difference is exactly 7 days minus 1 millisecond.
    const day = new Date(2024, 5, 12, 9, 0);
    expect(endOfWeek(day).getTime() - startOfWeek(day).getTime()).toBe(7 * 24 * 60 * 60 * 1000 - 1);
  });
});

describe('getWeekDates', () => {
  it('returns 7 consecutive dates starting on Monday', () => {
    const dates = getWeekDates(new Date(2024, 0, 3)); // Wednesday
    expect(dates.length).toBe(7);
    expectLocalDate(dates[0], 2024, 0, 1); // Monday
    expectLocalDate(dates[6], 2024, 0, 7); // Sunday
    for (let i = 1; i < 7; i++) {
      expect(dates[i].getDate() - dates[i - 1].getDate()).toBe(1);
    }
  });

  it('spans a month boundary correctly', () => {
    const dates = getWeekDates(new Date(2024, 0, 31)); // Wednesday Jan 31
    expectLocalDate(dates[0], 2024, 0, 29); // Monday Jan 29
    expectLocalDate(dates[6], 2024, 1, 4); // Sunday Feb 4
  });

  it('spans a year boundary correctly', () => {
    const dates = getWeekDates(new Date(2025, 0, 1)); // Wednesday Jan 1 2025
    expectLocalDate(dates[0], 2024, 11, 30); // Monday Dec 30 2024
    expectLocalDate(dates[6], 2025, 0, 5); // Sunday Jan 5 2025
  });

  it('is consistent with startOfWeek', () => {
    const day = new Date(2024, 8, 18, 14, 45);
    expect(getWeekDates(day)[0].getTime()).toBe(startOfWeek(day).getTime());
  });
});
