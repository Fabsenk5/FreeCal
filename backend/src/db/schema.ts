import { pgTable, uuid, text, boolean, timestamp, jsonb, integer, check, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Profiles Table (Extends Auth Users - though here we might treat it as the main user table)
export const profiles = pgTable('profiles', {
    id: uuid('id').primaryKey().defaultRandom(), // In migration, we might need to preserve UUIDs
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'), // Added for custom auth migration
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    calendarColor: text('calendar_color').notNull().default('hsl(217, 91%, 60%)'),
    isApproved: boolean('is_approved').default(false),
    approvalStatus: text('approval_status', { enum: ['pending', 'approved', 'rejected'] }).default('pending'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: uuid('approved_by'), // Self-reference if implementing foreign keys to profiles
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    resetToken: text('reset_token'),
    resetTokenExpires: timestamp('reset_token_expires', { withTimezone: true }),
});

// Relationships Table
export const relationships = pgTable('relationships', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    relatedUserId: uuid('related_user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['pending', 'accepted', 'rejected'] }).default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
    uniqueUserRelated: unique().on(t.userId, t.relatedUserId),
}));

// Events Table
export const events = pgTable('events', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    isAllDay: boolean('is_all_day').default(false),
    color: text('color').notNull(),
    recurrenceRule: text('recurrence_rule'),
    recurrenceType: text('recurrence_type', { enum: ['none', 'daily', 'weekly', 'monthly', 'custom'] }).default('none'),
    recurrenceDays: text('recurrence_days').array(),
    recurrenceInterval: integer('recurrence_interval'),
    recurrenceEndDate: timestamp('recurrence_end_date', { withTimezone: true }),
    importedFromDevice: boolean('imported_from_device').default(false),
    location: text('location'),
    url: text('url'),
    isTentative: boolean('is_tentative'),
    alerts: jsonb('alerts').array(),
    travelTime: text('travel_time'),
    originalCalendarId: text('original_calendar_id'),
    attendees: jsonb('attendees').array(), // Legacy field, keeping for schema match
    structuredMetadata: jsonb('structured_metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Event Attendees Table
export const eventAttendees = pgTable('event_attendees', {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['pending', 'accepted', 'declined'] }).default('pending'),
    isAttendee: boolean('is_attendee').default(true), // Added from recent checklist
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
    uniqueEventUser: unique().on(t.eventId, t.userId),
}));

// Event Viewers Table
export const eventViewers = pgTable('event_viewers', {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => ({
    uniqueEventUserViewer: unique().on(t.eventId, t.userId),
}));

// Feature Wishes Table
export const featureWishes = pgTable('feature_wishes', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    status: text('status', { enum: ['pending', 'completed'] }).default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    createdBy: uuid('created_by'), // Optional: track who created it (profile ID)
});
