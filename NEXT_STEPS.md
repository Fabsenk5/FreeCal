# Next Steps & Feature Roadmap

## High Priority (Should Do Soon)

### 1. Fix Partial Availability Display (Yellow Days)

**Status:** Attempted but reverted

**Issue:** Calendar should show yellow for days with partial availability

**Current:** Only shows green (fully free) or dark (no free time)

**Solution needed:**
- Fix `hasAnyFreeTime()` logic to properly detect partial availability
- Ensure yellow color applies to days with some (but not all) free time
- Update legend to show three states
- Files: `src/pages/FreeTimeFinder.tsx`

### 2. Improve Free Time Calculation

**Status:** Basic implementation

**Issues:**
- Currently uses hardcoded 9am-5pm window
- Doesn't properly check overlapping events for multiple users
- Day highlighting logic inconsistent

**Improvements needed:**
- Use actual time frame selection (already implemented in UI)
- Properly intersect availability across selected users
- Fix event filtering to only check attendees (not viewers)
- Handle overnight time frames correctly
- Files: `src/pages/FreeTimeFinder.tsx`

### 3. Email Notifications

**Status:** Not implemented

**What's needed:**
- Email service integration (SendGrid, Mailgun, or AWS SES)
- Templates for:
  - Relationship request
  - Relationship accepted
  - Event invitation
  - Admin approval notification
  - Event reminder (optional)
- Backend service or Edge Function to send emails
- Preference settings for email notifications

### 4. Merge Consecutive Time Slots (Free Time List)

**Status:** Attempted but reverted

**Issue:** Free time list shows multiple 30-min slots consecutively

**Example:** 9:00-9:30, 9:30-10:00, 10:00-10:30 instead of 9:00-10:30

**Solution needed:**
- Merge consecutive slots into larger blocks
- Display as "9:00 PM - 10:45 PM (1h 45min)"
- Files: `src/pages/FreeTimeFinder.tsx`

## Medium Priority (Nice to Have)

### 5. ICS Import from Device Calendar

**Status:** UI placeholder exists

**Priority:** Low-Medium

**Implementation:**
- Allow file upload (.ics format)
- Parse ICS file (use library like `ical.js`)
- Map ICS events to our schema
- Batch import events
- Handle recurring events from ICS
- Handle timezone conversions
- Mark as `imported_from_device=true`
- Files: `src/pages/CreateEvent.tsx`

### 6. Recurring Event Improvements

**Status:** Basic implementation

**Current:** Database stores recurrence rules but calendar doesn't expand them

**Needed:**
- Expand recurring events for display (generate instances)
- Edit recurring events ("this event" vs "all events")
- Delete recurring events with options
- Visual indication of recurring events in calendar
- Better recurrence rule UI ("Every 2 weeks on Mon, Wed, Fri")

### 7. Event Reminders/Notifications

**Status:** Not implemented

**Features:**
- In-app notifications for upcoming events
- Browser push notifications
- Configurable reminder times (15 min, 1 hour, 1 day before)
- Notification preferences per user

### 8. Calendar Sync (Export)

**Status:** Not implemented

**Features:**
- Export to ICS file
- Generate public calendar URL (read-only)
- Subscribe to FreeCal calendar in other apps
- Sync with Google Calendar (OAuth integration)

### 9. Search & Filters

**Status:** Not implemented

**Features:**
- Search events by title, description
- Filter by date range
- Filter by attendees
- Filter by event type
- Quick filters ("This week", "Next 30 days")

### 10. Event Templates

**Status:** Not implemented

**Features:**
- Save event as template
- Quick create from template
- Common templates ("Weekly Team Meeting", "Doctor Appointment")
- Share templates with relationships

## Low Priority (Future Ideas)

### 11. Mobile App (React Native)

**Status:** Discussed, not implemented

**Approach:**
- React Native wrapper around web app (WebView)
- Native calendar access for iOS/Android
- Push notifications
- Offline support
- Native date/time pickers

### 12. Time Zone Support

**Status:** Removed from prototype

**Consideration:**
- Currently all times are UTC
- Need per-user timezone preference
- Display events in user's local time
- Handle timezone conversions in Free Time Finder

### 13. Event Attachments

**Status:** Not implemented

**Features:**
- Attach files to events
- File storage (Altan Storage or S3)
- View/download attachments
- File size limits

### 14. Event Comments/Discussion

**Status:** Not implemented

**Features:**
- Comments thread per event
- Attendees can discuss event details
- Notifications for new comments

### 15. Analytics & Insights

**Status:** Not implemented

**Features:**
- "Your week at a glance"
- Meeting load analysis
- Free time statistics
- Busiest days/times
- Event type breakdown

## Technical Debt & Improvements

### Code Quality
- [ ] Add comprehensive TypeScript types (some `any` types exist)
- [ ] Add JSDoc comments to complex functions
- [ ] Extract magic numbers to constants
- [ ] Improve error messages (more user-friendly)

### Performance
- [ ] Implement event caching (React Query or SWR)
- [ ] Lazy load calendar views
- [ ] Optimize database queries (reduce joins)
- [ ] Add loading skeletons instead of spinners

### Testing
- [ ] Add unit tests (Vitest)
- [ ] Add integration tests (Playwright)
- [ ] Add E2E tests for critical flows
- [ ] Add visual regression tests

### Accessibility
- [ ] Keyboard navigation improvements
- [ ] Screen reader support
- [ ] ARIA labels
- [ ] Focus management in modals
- [ ] Color contrast improvements

### Security
- [ ] Rate limiting for API requests
- [ ] CSRF protection
- [ ] Input sanitization
- [ ] Content Security Policy
- [ ] Audit dependencies for vulnerabilities

## Bugs & Known Issues

### Current Bugs
- None reported (as of last testing)

### Edge Cases to Handle
- [ ] Very long event titles (truncation)
- [ ] Events spanning multiple days
- [ ] Concurrent event editing (optimistic locking)
- [ ] Large number of relationships (pagination)
- [ ] Large number of events (virtualization)

## Documentation Needs
- [ ] User guide / Help section
- [ ] FAQ
- [ ] Video tutorials
- [ ] API documentation (if exposing APIs)
- [ ] Database migration guide
- [ ] Backup/restore procedures

## Feature Requests (User Feedback)

*This section will be populated as users provide feedback*

## Decision Log

### Decisions Made

**Attendees vs Viewers:**
- Decision: Separate tables (`event_attendees` and `event_viewers`)
- Reason: Cleaner separation, better for queries
- Date: 2025-11-24

**Admin Approval System:**
- Decision: Email-based with manual approval
- Reason: Private beta, controlled user base
- Date: 2025-11-23

**Time Frame Selection:**
- Decision: Dual-slider for 48-hour range
- Reason: Covers overnight and next-day scheduling
- Date: 2025-11-23

### Decisions Pending

**Email Service Provider:**
- Options: SendGrid, Mailgun, AWS SES, Resend
- Factors: Cost, ease of use, reliability
- Timeline: TBD

**Mobile App Approach:**
- Options: React Native WebView, Full React Native, PWA only
- Factors: Development time, native features needed
- Timeline: TBD

## Success Metrics (When Launched)

- User signups
- Active users (DAU/MAU)
- Events created per user
- Relationships per user
- Free time finder usage
- User retention
- Net Promoter Score (NPS)
