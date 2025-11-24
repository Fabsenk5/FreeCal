# ✅ Implementation Checklist: Attendees vs Viewers

**Project:** FreeCal  
**Feature:** Separate Event Attendees from Viewers  
**Status:** PENDING APPROVAL

---

## 📋 Pre-Implementation Checklist

- [ ] User has approved the proposal
- [ ] User has answered all 6 decision questions
- [ ] Database backup created (if production)
- [ ] All current tests passing
- [ ] Development environment ready

---

## Phase 1: Database Migration ⚡ CRITICAL

### 1.1 Create Migration Script
**File:** Create new SQL file  
**Estimated time:** 10 min

- [ ] Create file: `migrations/add_is_attendee_column.sql`
- [ ] Copy migration script from proposal
- [ ] Review SQL for correctness
- [ ] Test on development database first

### 1.2 Execute Migration
**Estimated time:** 10 min

- [ ] Run migration script:
  ```bash
  # Execute SQL via Supabase dashboard or CLI
  ```
- [ ] Verify column added:
  ```sql
  \d event_attendees
  ```
- [ ] Check data migrated correctly:
  ```sql
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_attendee = true) as attendees,
    COUNT(*) FILTER (WHERE is_attendee = false) as viewers
  FROM event_attendees;
  ```
- [ ] Verify creators are marked as attendees
- [ ] Verify index created

### 1.3 Verify Migration Success
**Estimated time:** 10 min

**Verification Queries:**
```sql
-- 1. Check structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'event_attendees'
ORDER BY ordinal_position;

-- 2. Check creator attendance (should all be TRUE)
SELECT 
  e.title,
  e.user_id as creator_id,
  ea.user_id as attendee_id,
  ea.is_attendee,
  (e.user_id = ea.user_id) as is_creator_record
FROM events e
JOIN event_attendees ea ON ea.event_id = e.id
WHERE e.user_id = ea.user_id
LIMIT 10;

-- 3. Find events without attendees (should be ZERO)
SELECT COUNT(*)
FROM events e
WHERE NOT EXISTS (
  SELECT 1 FROM event_attendees ea
  WHERE ea.event_id = e.id AND ea.is_attendee = true
);

-- 4. Distribution check
SELECT 
  is_attendee,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM event_attendees
GROUP BY is_attendee;
```

**Expected Results:**
- [ ] Column `is_attendee` exists with type BOOLEAN
- [ ] All creator records have `is_attendee = true`
- [ ] Zero events without attendees
- [ ] Migration statistics look reasonable

---

## Phase 2: TypeScript Types 🔧

### 2.1 Update Database Types
**File:** `src/lib/supabase.ts`  
**Estimated time:** 10 min

**Changes needed:**
```typescript
// FIND: EventAttendee type definition
// ADD: is_attendee field

// BEFORE:
export type EventAttendee = Database['public']['Tables']['event_attendees']['Row'];
// Which expands to:
// {
//   id: string;
//   event_id: string;
//   user_id: string;
//   created_at: string;
// }

// AFTER:
// The type should auto-update from database, but if using manual types:
export type EventAttendee = {
  id: string;
  event_id: string;
  user_id: string;
  is_attendee: boolean; // ← ADD THIS
  created_at: string;
};
```

**Checklist:**
- [ ] Update `EventAttendee` type to include `is_attendee: boolean`
- [ ] If using generated types, regenerate:
  ```bash
  npx supabase gen types typescript --project-id eeaf921a-3e95-4654-9149-965869a1afef
  ```
- [ ] Verify no TypeScript errors
- [ ] Run linter: `npm run lint`

### 2.2 Update Extended Types
**File:** `src/hooks/useEvents.ts`  
**Estimated time:** 5 min

**Changes needed:**
```typescript
// FIND: EventWithAttendees interface
// UPDATE: attendees field structure

// BEFORE:
export interface EventWithAttendees extends Event {
  attendees?: string[]; // Array of user IDs
  creator_name?: string;
  creator_color?: string;
}

// AFTER:
export interface EventWithAttendees extends Event {
  attendees?: Array<{  // ← CHANGE to array of objects
    user_id: string;
    is_attendee: boolean;
  }>;
  creator_name?: string;
  creator_color?: string;
}
```

**Checklist:**
- [ ] Update `EventWithAttendees` interface
- [ ] Check for other files using this type
- [ ] Fix any type errors that appear
- [ ] Run TypeScript compiler: `npm run build`

---

## Phase 3: Data Fetching 📡

### 3.1 Update Event Fetching Query
**File:** `src/hooks/useEvents.ts`  
**Estimated time:** 15 min

**Current code location:** Lines ~85-95

**Changes needed:**
```typescript
// FIND: Attendees fetch query inside eventsWithDetails map
// CHANGE: Add is_attendee to select

// BEFORE:
const { data: attendees } = await supabase
  .from('event_attendees')
  .select('user_id')
  .eq('event_id', event.id);

// AFTER:
const { data: attendees } = await supabase
  .from('event_attendees')
  .select('user_id, is_attendee') // ← ADD is_attendee
  .eq('event_id', event.id);

// BEFORE:
return {
  ...event,
  attendees: attendees?.map((a) => a.user_id) || [],
  creator_name: creator?.display_name,
  creator_color: creator?.calendar_color || 'hsl(217, 91%, 60%)',
};

// AFTER:
return {
  ...event,
  attendees: attendees?.map((a) => ({
    user_id: a.user_id,
    is_attendee: a.is_attendee,
  })) || [],
  creator_name: creator?.display_name,
  creator_color: creator?.calendar_color || 'hsl(217, 91%, 60%)',
};
```

**Checklist:**
- [ ] Update select to include `is_attendee`
- [ ] Change `.map()` to return object instead of string
- [ ] Verify query works in Supabase dashboard
- [ ] Test with console.log to verify data shape
- [ ] Fix any downstream TypeScript errors

### 3.2 Test Data Fetching
**Estimated time:** 5 min

**Console test:**
```typescript
// Add temporary logging in useEvents.ts
console.log('Event with attendees:', eventsWithDetails[0]);

// Expected output:
// {
//   id: "...",
//   title: "Team Meeting",
//   attendees: [
//     { user_id: "abc123", is_attendee: true },
//     { user_id: "def456", is_attendee: false }
//   ],
//   ...
// }
```

**Checklist:**
- [ ] Events load successfully
- [ ] Attendees array contains objects with `user_id` and `is_attendee`
- [ ] No console errors
- [ ] Performance is acceptable (no N+1 queries)

---

## Phase 4: UI Updates 🎨

### 4.1 Update CreateEvent Form
**File:** `src/pages/CreateEvent.tsx`  
**Estimated time:** 45 min

#### 4.1.1 Add State for Viewers
**Current location:** State declarations at top

**Changes needed:**
```typescript
// FIND: State declarations
// ADD: viewers state

// ADD AFTER: const [attendees, setAttendees] = useState<string[]>([]);
const [viewers, setViewers] = useState<string[]>([]);
```

**Checklist:**
- [ ] Add `viewers` state
- [ ] Add `setViewers` setter

#### 4.1.2 Update Event Loading (Edit Mode)
**Current location:** Lines ~100-130 (useEffect for eventToEdit)

**Changes needed:**
```typescript
// FIND: setAttendees in edit mode
// CHANGE: Split into attendees and viewers

// BEFORE:
setAttendees(eventToEdit.attendees || []);

// AFTER:
const attendeesList = eventToEdit.attendees
  ?.filter((a) => a.is_attendee)
  ?.map((a) => a.user_id) || [];
const viewersList = eventToEdit.attendees
  ?.filter((a) => !a.is_attendee)
  ?.map((a) => a.user_id) || [];

setAttendees(attendeesList);
setViewers(viewersList);
```

**Checklist:**
- [ ] Split attendees array into attendees + viewers
- [ ] Load both states when editing
- [ ] Test edit mode loads correctly

#### 4.1.3 Add Toggle Functions
**Current location:** After `toggleAttendee` function

**Changes needed:**
```typescript
// FIND: toggleAttendee function
// ADD: toggleViewer function after it

const toggleAttendee = (userId: string) => {
  // Remove from viewers if present
  setViewers((prev) => prev.filter((id) => id !== userId));
  
  // Toggle in attendees
  setAttendees((prev) =>
    prev.includes(userId) 
      ? prev.filter((id) => id !== userId) 
      : [...prev, userId]
  );
};

const toggleViewer = (userId: string) => {
  // Remove from attendees if present
  setAttendees((prev) => prev.filter((id) => id !== userId));
  
  // Toggle in viewers
  setViewers((prev) =>
    prev.includes(userId) 
      ? prev.filter((id) => id !== userId) 
      : [...prev, userId]
  );
};
```

**Checklist:**
- [ ] Update `toggleAttendee` to remove from viewers first
- [ ] Add `toggleViewer` function
- [ ] Ensure user can't be in both lists

#### 4.1.4 Update Save Logic
**Current location:** `handleSave` function, attendee insertion

**Changes needed:**
```typescript
// FIND: attendeeRecords creation
// CHANGE: Include is_attendee flag

// BEFORE:
const attendeeRecords = [
  { event_id: newEvent.id, user_id: user.id },
  ...attendees.map((attendeeId) => ({
    event_id: newEvent.id,
    user_id: attendeeId,
  })),
];

// AFTER:
const attendeeRecords = [
  // Creator is always an attendee
  { 
    event_id: newEvent.id, 
    user_id: user.id,
    is_attendee: true, // ← ADD
  },
  // Other attendees
  ...attendees.map((attendeeId) => ({
    event_id: newEvent.id,
    user_id: attendeeId,
    is_attendee: true, // ← ADD
  })),
  // Viewers
  ...viewers.map((viewerId) => ({
    event_id: newEvent.id,
    user_id: viewerId,
    is_attendee: false, // ← ADD
  })),
];
```

**Checklist:**
- [ ] Add `is_attendee: true` for creator
- [ ] Add `is_attendee: true` for attendees
- [ ] Add `is_attendee: false` for viewers
- [ ] Update both CREATE and UPDATE paths
- [ ] Test saving new event
- [ ] Test updating existing event

#### 4.1.5 Update UI - Split Sections
**Current location:** Attendees section in JSX

**Changes needed:**
```tsx
{/* FIND: Current attendees section */}
{/* REPLACE WITH: Two separate sections */}

{/* Section 1: Attendees */}
<div className="space-y-2">
  <div className="flex items-center gap-2">
    <Label>👥 Attendees</Label>
    <span className="text-xs text-muted-foreground">
      (Blocks their calendar)
    </span>
  </div>
  <div className="space-y-2">
    {relationships.map((rel) => (
      <button
        key={rel.id}
        type="button"
        onClick={() => toggleAttendee(rel.profile.id)}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
          attendees.includes(rel.profile.id)
            ? "bg-primary/10 border-l-4 border-primary"
            : "bg-card hover:bg-accent"
        )}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: rel.profile.calendar_color }}
        />
        <span className="flex-1 text-left text-sm">
          {rel.profile.display_name}
        </span>
        {attendees.includes(rel.profile.id) && (
          <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
            ✓
          </div>
        )}
      </button>
    ))}
  </div>
</div>

{/* Section 2: Viewers */}
<div className="space-y-2 mt-4">
  <div className="flex items-center gap-2">
    <Label>👁️ Shared with (Viewers)</Label>
    <span className="text-xs text-muted-foreground">
      (View only, doesn't block)
    </span>
  </div>
  <div className="space-y-2">
    {relationships.map((rel) => (
      <button
        key={rel.id}
        type="button"
        onClick={() => toggleViewer(rel.profile.id)}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
          viewers.includes(rel.profile.id)
            ? "bg-muted/50 border-l-4 border-muted-foreground"
            : "bg-card hover:bg-accent"
        )}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: rel.profile.calendar_color }}
        />
        <span className="flex-1 text-left text-sm">
          {rel.profile.display_name}
        </span>
        {viewers.includes(rel.profile.id) && (
          <div className="w-5 h-5 rounded-full bg-muted-foreground text-background flex items-center justify-center text-xs">
            ✓
          </div>
        )}
      </button>
    ))}
  </div>
</div>

{/* Help text */}
<div className="mt-4 bg-muted/30 p-3 rounded-lg">
  <p className="text-xs text-muted-foreground">
    💡 Add people as <strong>Viewers</strong> to share your schedule 
    without blocking their calendar.
  </p>
</div>
```

**Checklist:**
- [ ] Split into two sections (Attendees + Viewers)
- [ ] Different styling for each (primary vs muted)
- [ ] Add explanatory text
- [ ] Add help tooltip/text
- [ ] Test clicking works correctly
- [ ] Verify mutual exclusivity (can't be both)

#### 4.1.6 Update Reset Form
**Current location:** `resetForm` function

**Changes needed:**
```typescript
// FIND: setAttendees([])
// ADD: setViewers([]) after it

const resetForm = () => {
  // ... existing resets ...
  setAttendees([]);
  setViewers([]); // ← ADD THIS
  // ... rest of resets ...
};
```

**Checklist:**
- [ ] Add `setViewers([])` to reset function
- [ ] Test form reset works

### 4.2 Update EventCard Component
**File:** `src/components/calendar/EventCard.tsx`  
**Estimated time:** 20 min

**Note:** This file may not exist yet. Check first.

**If file exists, add badges:**
```tsx
// Inside event card, add status badges
{event.user_id === currentUser?.id ? (
  <Badge variant="default" className="text-xs">
    <Calendar className="w-3 h-3 mr-1" />
    Your Event
  </Badge>
) : event.attendees?.some((a) => a.user_id === currentUser?.id && a.is_attendee) ? (
  <Badge variant="default" className="text-xs">
    <Users className="w-3 h-3 mr-1" />
    Attending
  </Badge>
) : event.attendees?.some((a) => a.user_id === currentUser?.id && !a.is_attendee) ? (
  <Badge variant="secondary" className="text-xs opacity-70">
    <Eye className="w-3 h-3 mr-1" />
    Viewing
  </Badge>
) : null}
```

**If file doesn't exist:**
- [ ] Check where events are rendered
- [ ] Add inline badges in that location

**Checklist:**
- [ ] Import icons: `import { Users, Eye, Calendar } from 'lucide-react'`
- [ ] Add conditional badges
- [ ] Style viewer events with opacity
- [ ] Test badges appear correctly

---

## Phase 5: Free Time Finder Logic ⚡ CRITICAL

### 5.1 Update isTimeSlotFree Function
**File:** `src/pages/FreeTimeFinder.tsx`  
**Estimated time:** 15 min

**Current location:** Line ~125

**Changes needed:**
```typescript
// FIND: isUserInvolved check
// CHANGE: Filter for is_attendee = true only

// BEFORE:
const isUserInvolved =
  selectedUsers.includes(event.user_id) ||
  event.attendees?.some((attendeeId) => selectedUsers.includes(attendeeId));

// AFTER:
const isUserAttending =
  selectedUsers.includes(event.user_id) || // Creator always blocks
  event.attendees?.some((a) => 
    selectedUsers.includes(a.user_id) && a.is_attendee === true
  );

// Then use isUserAttending instead of isUserInvolved
if (!isUserAttending) return false;
```

**Checklist:**
- [ ] Update variable name to `isUserAttending`
- [ ] Add `.is_attendee === true` filter
- [ ] Test with console logs
- [ ] Verify viewers don't block calendar

### 5.2 Update isDateFree Function
**File:** `src/pages/FreeTimeFinder.tsx`  
**Estimated time:** 10 min

**Current location:** Line ~240

**Changes needed:**
```typescript
// FIND: Similar isUserInvolved check
// APPLY: Same changes as above

// BEFORE:
const isUserInvolved =
  selectedUsers.includes(event.user_id) ||
  event.attendees?.some((attendeeId) => selectedUsers.includes(attendeeId));

// AFTER:
const isUserAttending =
  selectedUsers.includes(event.user_id) ||
  event.attendees?.some((a) => 
    selectedUsers.includes(a.user_id) && a.is_attendee === true
  );

return isSameDate && isUserAttending;
```

**Checklist:**
- [ ] Update both functions
- [ ] Ensure consistent logic
- [ ] Test calendar view
- [ ] Test list view

### 5.3 Test Free Time Finder
**Estimated time:** 15 min

**Test scenarios:**
1. User A creates event
2. User B is added as attendee
3. User C is added as viewer
4. Check free time for:
   - A + B → Should show as blocked ✅
   - A + C → Should show as available ✅
   - B + C → Should show as available ✅

**Checklist:**
- [ ] Create test event with attendees and viewers
- [ ] Verify attendees block calendar
- [ ] Verify viewers don't block calendar
- [ ] Check both calendar and list views
- [ ] Test edge cases (event creator, multiple users)

---

## Phase 6: Testing 🧪

### 6.1 Unit Tests (If applicable)
**Estimated time:** 20 min

**Test cases:**
```typescript
// Test attendee vs viewer logic
describe('Free Time Finder', () => {
  it('should block time for attendees', () => {
    // Test logic
  });

  it('should NOT block time for viewers', () => {
    // Test logic
  });

  it('should always block time for event creator', () => {
    // Test logic
  });
});
```

**Checklist:**
- [ ] Write unit tests (if project has tests)
- [ ] Run test suite: `npm test`
- [ ] Fix any failing tests
- [ ] Achieve >80% coverage on new code

### 6.2 Manual Testing
**Estimated time:** 30 min

#### Test Case 1: Create New Event
- [ ] Open Create Event form
- [ ] Verify two sections appear (Attendees + Viewers)
- [ ] Add user to Attendees
- [ ] Add different user to Viewers
- [ ] Save event
- [ ] Verify saved correctly in database
- [ ] Check event shows badges correctly

#### Test Case 2: Edit Existing Event
- [ ] Open event for editing
- [ ] Verify attendees load in correct section
- [ ] Verify viewers load in correct section
- [ ] Move user from attendee to viewer
- [ ] Save changes
- [ ] Verify changes persisted

#### Test Case 3: Free Time Finder
- [ ] Select user who is attendee of an event
- [ ] Verify event blocks their time
- [ ] Select user who is viewer of same event
- [ ] Verify event doesn't block their time
- [ ] Test with multiple users

#### Test Case 4: Calendar Display
- [ ] View calendar with mixed events
- [ ] Verify "Your Event" badge
- [ ] Verify "Attending" badge  
- [ ] Verify "Viewing" badge (with opacity)
- [ ] Check different views (day/week/month)

#### Test Case 5: Edge Cases
- [ ] Event with only viewers (no attendees)
- [ ] Event with only attendees (no viewers)
- [ ] User is both creator and attendee
- [ ] Empty attendees and viewers
- [ ] Toggle user between sections rapidly

### 6.3 Performance Testing
**Estimated time:** 10 min

**Metrics to check:**
- [ ] Event loading time (should be <500ms)
- [ ] Free time calculation (should be <1s)
- [ ] No N+1 query issues
- [ ] Database query count reasonable

**Tools:**
- Chrome DevTools Network tab
- Supabase dashboard query logs
- React DevTools Profiler

---

## Phase 7: Polish & Documentation 📝

### 7.1 Update README (if needed)
**File:** `README.md`  
**Estimated time:** 10 min

**Add section:**
```markdown
## Event Sharing

### Attendees vs Viewers

When creating events, you can share with two types of participants:

- **Attendees**: People attending the event. Blocks their calendar.
- **Viewers**: People who can see the event. Doesn't block their calendar.

Use viewers when you want to inform others of your schedule without 
affecting their availability.
```

**Checklist:**
- [ ] Add feature documentation
- [ ] Update screenshots (if any)
- [ ] Document any breaking changes

### 7.2 Add Code Comments
**Estimated time:** 10 min

**Key locations to comment:**
- [ ] Migration SQL file
- [ ] `is_attendee` field usage
- [ ] Free Time Finder logic changes
- [ ] Type definitions

### 7.3 Update CHANGELOG
**File:** `CHANGELOG.md` (create if doesn't exist)  
**Estimated time:** 5 min

```markdown
## [Unreleased]

### Added
- Separate attendees from viewers for events
- Attendees block calendar time, viewers are informational only
- Visual distinction between attending and viewing events
- Two-section UI in event creation form

### Changed
- Free Time Finder now only considers attendees (not viewers)
- Event cards show status badges (Attending/Viewing)
- Database schema: added `is_attendee` column to `event_attendees`

### Migration
- Existing shared events converted to viewers by default
- Event creators automatically marked as attendees
```

---

## Phase 8: Deployment 🚀

### 8.1 Pre-Deployment Checklist
- [ ] All tests passing
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Linter passing
- [ ] Database migration tested on staging
- [ ] User acceptance testing complete
- [ ] Documentation updated

### 8.2 Deployment Steps
- [ ] Run database migration on production
- [ ] Deploy frontend changes
- [ ] Monitor error logs
- [ ] Test critical paths in production
- [ ] Verify migration successful

### 8.3 Post-Deployment Monitoring
**First 24 hours:**
- [ ] Check error logs every 2 hours
- [ ] Monitor database performance
- [ ] Watch for user feedback
- [ ] Verify Free Time Finder working
- [ ] Check event creation/editing

### 8.4 Rollback Plan (if needed)
```sql
-- Emergency rollback
BEGIN;

-- Drop the column
ALTER TABLE event_attendees DROP COLUMN is_attendee;

-- Drop the index
DROP INDEX IF EXISTS idx_event_attendees_is_attendee;

COMMIT;
```

**Frontend rollback:**
- [ ] Revert to previous git commit
- [ ] Redeploy
- [ ] Verify system working

---

## 📊 Definition of Done

### Feature Complete When:
- [x] Database migration successful
- [x] TypeScript types updated
- [x] Event creation form has two sections
- [x] Event editing preserves attendee/viewer status
- [x] Free Time Finder respects attendee/viewer distinction
- [x] Calendar displays correct badges
- [x] All tests passing
- [x] No TypeScript errors
- [x] No linter warnings
- [x] Documentation updated
- [x] User testing complete
- [x] Production deployment successful

### Quality Gates:
- [ ] Code review approved (if applicable)
- [ ] No regressions in existing features
- [ ] Performance acceptable (<500ms load time)
- [ ] Mobile responsive
- [ ] Accessible (ARIA labels, keyboard navigation)
- [ ] Error handling in place

---

## 🐛 Known Issues / Tech Debt

Document any issues found during implementation:

1. Issue: _____
   - Impact: _____
   - Workaround: _____
   - Future fix: _____

2. Tech debt: _____
   - Reason: _____
   - Plan: _____

---

## 📈 Metrics to Track

### Before Implementation:
- Event creation time: _____
- Free time calculation time: _____
- User complaints about calendar blocking: _____

### After Implementation:
- Event creation time: _____
- Free time calculation time: _____
- User satisfaction with attendee/viewer split: _____
- % of events using viewers: _____

---

## 🎯 Success Criteria

**Feature is successful if:**
1. ✅ Viewers don't block calendar in Free Time Finder
2. ✅ Attendees correctly block calendar time
3. ✅ UI clearly distinguishes attendees from viewers
4. ✅ No performance degradation
5. ✅ Migration completed without data loss
6. ✅ User feedback is positive

---

**TOTAL ESTIMATED TIME: 3-4 hours**

**PRIORITY TASKS (Do first):**
1. Database migration ⚡
2. Free Time Finder logic ⚡
3. Event creation form update ⚡

**NICE TO HAVE (Can defer):**
4. Enhanced calendar styling
5. Notification improvements
6. Quick promote/demote actions

---

**END OF CHECKLIST**

Use this document to track progress during implementation.
Check off each item as you complete it.
