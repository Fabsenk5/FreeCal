export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

export const getFirstDayOfMonth = (year: number, month: number): number => {
  return new Date(year, month, 1).getDay();
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatDateTime = (date: Date): string => {
  return `${formatDate(date)} at ${formatTime(date)}`;
};

export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

export const isToday = (date: Date): boolean => {
  return isSameDay(date, new Date());
};


export const getWeekDays = (): string[] => {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
};

export const getMonthName = (month: number): string => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month];
};

export const getCalendarDays = (year: number, month: number): (Date | null)[] => {
  // getDay() returns 0 for Sunday, 1 for Monday, etc.
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  // Convert to Monday-based index: 0=Mon, 1=Tue, ..., 6=Sun
  // Sunday (0) becomes 6. Monday (1) becomes 0.
  const firstDay = (firstDayOfWeek + 6) % 7;

  const daysInMonth = getDaysInMonth(year, month);
  const days: (Date | null)[] = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }

  return days;
};

export const addMonths = (date: Date, months: number): Date => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + months);
  return newDate;
};

export const startOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) to 6 (Sat)

  // Calculate difference to get to Monday
  // If Mon (1), diff is 0. If Tue (2), diff is 1. ... If Sun (0), diff is 6.
  const diff = day === 0 ? 6 : day - 1;

  d.setDate(d.getDate() - diff);
  return new Date(d.setHours(0, 0, 0, 0));
};

export const endOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) to 6 (Sat)

  // Calculate difference to get to Sunday
  // If Mon (1), diff is 6. If Tue (2), diff is 5. ... If Sun (0), diff is 0.
  const diff = day === 0 ? 0 : 7 - day;

  d.setDate(d.getDate() + diff);
  return new Date(d.setHours(23, 59, 59, 999));
};

export const getWeekDates = (date: Date): Date[] => {
  const start = startOfWeek(date);
  const dates: Date[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }

  return dates;
};
