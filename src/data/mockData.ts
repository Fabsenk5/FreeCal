export interface User {
  id: string;
  name: string;
  email: string;
  color: 'self' | 'partner1' | 'partner2';
  relationshipType: 'self' | 'partner' | 'family';
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  userId: string;
  attendeeIds: string[];
  viewerIds?: string[]; // Added for viewers feature
  isViewer?: boolean; // Whether current user is only a viewer (not creator or attendee)
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
    interval?: number;
    endDate?: Date;
    daysOfWeek?: number[];
  };
  color: string; // Changed to string to support actual HSL colors
  creatorName?: string; // Added to display creator name
}

export const MOCK_USERS: User[] = [
  {
    id: 'user-1',
    name: 'Alex Morgan',
    email: 'alex.morgan@example.com',
    color: 'self',
    relationshipType: 'self',
  },
  {
    id: 'user-2',
    name: 'Jordan Taylor',
    email: 'jordan.taylor@example.com',
    color: 'partner1',
    relationshipType: 'partner',
  },
  {
    id: 'user-3',
    name: 'Casey Rivera',
    email: 'casey.rivera@example.com',
    color: 'partner2',
    relationshipType: 'partner',
  },
];

export const MOCK_EVENTS: CalendarEvent[] = [
  // Alex's events (blue)
  {
    id: 'event-1',
    title: 'Morning Yoga',
    description: 'Daily yoga routine',
    startDate: new Date(2024, 11, 18, 7, 0),
    endDate: new Date(2024, 11, 18, 8, 0),
    isAllDay: false,
    userId: 'user-1',
    attendeeIds: ['user-1'],
    recurrence: { frequency: 'daily' },
    color: 'self',
  },
  {
    id: 'event-2',
    title: 'Team Meeting',
    description: 'Weekly sync with the team',
    startDate: new Date(2024, 11, 20, 10, 0),
    endDate: new Date(2024, 11, 20, 11, 30),
    isAllDay: false,
    userId: 'user-1',
    attendeeIds: ['user-1'],
    recurrence: { frequency: 'weekly', daysOfWeek: [5] },
    color: 'self',
  },
  {
    id: 'event-3',
    title: 'Lunch with Sarah',
    startDate: new Date(2024, 11, 22, 12, 30),
    endDate: new Date(2024, 11, 22, 13, 30),
    isAllDay: false,
    userId: 'user-1',
    attendeeIds: ['user-1'],
    color: 'self',
  },
  {
    id: 'event-4',
    title: 'Project Deadline',
    description: 'Submit Q4 report',
    startDate: new Date(2024, 11, 25, 0, 0),
    endDate: new Date(2024, 11, 25, 23, 59),
    isAllDay: true,
    userId: 'user-1',
    attendeeIds: ['user-1'],
    color: 'self',
  },
  // Jordan's events (purple)
  {
    id: 'event-5',
    title: 'Client Call',
    description: 'Review Q4 results',
    startDate: new Date(2024, 11, 19, 9, 0),
    endDate: new Date(2024, 11, 19, 10, 0),
    isAllDay: false,
    userId: 'user-2',
    attendeeIds: ['user-2'],
    color: 'partner1',
  },
  {
    id: 'event-6',
    title: 'Dentist Appointment',
    startDate: new Date(2024, 11, 21, 14, 0),
    endDate: new Date(2024, 11, 21, 15, 0),
    isAllDay: false,
    userId: 'user-2',
    attendeeIds: ['user-2'],
    color: 'partner1',
  },
  {
    id: 'event-7',
    title: 'Weekend Trip Planning',
    description: 'Plan December getaway',
    startDate: new Date(2024, 11, 23, 19, 0),
    endDate: new Date(2024, 11, 23, 20, 30),
    isAllDay: false,
    userId: 'user-2',
    attendeeIds: ['user-1', 'user-2', 'user-3'],
    color: 'partner1',
  },
  // Casey's events (green)
  {
    id: 'event-8',
    title: 'Morning Run',
    description: '5K run in the park',
    startDate: new Date(2024, 11, 18, 6, 0),
    endDate: new Date(2024, 11, 18, 7, 0),
    isAllDay: false,
    userId: 'user-3',
    attendeeIds: ['user-3'],
    recurrence: { frequency: 'weekly', daysOfWeek: [1, 3, 5] },
    color: 'partner2',
  },
  {
    id: 'event-9',
    title: 'Book Club',
    description: 'Monthly book discussion',
    startDate: new Date(2024, 11, 24, 18, 0),
    endDate: new Date(2024, 11, 24, 20, 0),
    isAllDay: false,
    userId: 'user-3',
    attendeeIds: ['user-3'],
    recurrence: { frequency: 'monthly' },
    color: 'partner2',
  },
  {
    id: 'event-10',
    title: 'Family Dinner',
    description: 'Sunday family gathering',
    startDate: new Date(2024, 11, 22, 18, 0),
    endDate: new Date(2024, 11, 22, 21, 0),
    isAllDay: false,
    userId: 'user-3',
    attendeeIds: ['user-1', 'user-2', 'user-3'],
    recurrence: { frequency: 'weekly', daysOfWeek: [0] },
    color: 'partner2',
  },
  // Additional events for demonstration
  {
    id: 'event-11',
    title: 'Workshop: Design Systems',
    description: 'Advanced design systems workshop',
    startDate: new Date(2024, 11, 26, 9, 0),
    endDate: new Date(2024, 11, 26, 17, 0),
    isAllDay: false,
    userId: 'user-1',
    attendeeIds: ['user-1'],
    color: 'self',
  },
  {
    id: 'event-12',
    title: 'Holiday Party',
    description: 'Annual company holiday celebration',
    startDate: new Date(2024, 11, 27, 18, 0),
    endDate: new Date(2024, 11, 27, 22, 0),
    isAllDay: false,
    userId: 'user-1',
    attendeeIds: ['user-1', 'user-2'],
    color: 'self',
  },
];

export const getCurrentUser = (): User => MOCK_USERS[0];

export const getUserById = (id: string): User | undefined => {
  return MOCK_USERS.find(user => user.id === id);
};

export const getUsersByIds = (ids: string[]): User[] => {
  return MOCK_USERS.filter(user => ids.includes(user.id));
};