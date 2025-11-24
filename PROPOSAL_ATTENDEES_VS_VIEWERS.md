# 📋 Proposal: Separate Event Attendees from Viewers

**Date:** 2025-11-24  
**Status:** PENDING USER APPROVAL  
**Priority:** High - Fixes critical UX issue

---

## 🎯 Executive Summary

**Problem:** When events are shared with other users, they incorrectly block the recipient's calendar. This conflates visibility (seeing an event) with attendance (participating in it).

**Solution:** Add an `is_attendee` boolean to the existing `event_attendees` table to distinguish between:
- **Attendees** → Users attending the event (blocks their calendar)
- **Viewers** → Users who can see the event (informational only, doesn't block)

---

## 📊 Current State Analysis

### Current Database Schema
```sql
-- event_attendees table (existing)
CREATE TABLE event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Current Behavior
1. Event creator adds users to `event_attendees` table
2. Free Time Finder treats **all** users in this table as blocked
3. No distinction between "viewing" and "attending"

### Code Impact Points
**Files Currently Using event_attendees:**
- `src/hooks/useEvents.ts` (lines 41, 85) - Fetching events
- `src/pages/CreateEvent.tsx` (lines 310, 320, 354) - Creating/updating attendees
- `src/pages/FreeTimeFinder.tsx` (line 125) - Checking availability
- `src/lib/supabase.ts` (lines 171, 198) - Type definitions

---

## ✅ Recommended Solution: Option A (Add Boolean Column)

### Why Option A?
- **Simplest implementation** - Single column addition
- **Minimal code changes** - Existing queries mostly unchanged
- **Backward compatible** - Existing records can be migrated safely
- **Clear semantics** - `is_attendee` is self-documenting
- **Performance** - No additional JOINs required

### Alternative: Option B (Separate Tables)
**Not Recommended** because:
- More complex schema with 2 tables instead of 1
- Requires more queries (JOIN both tables to get all shared users)
- Migration more complex
- Over-engineered for the use case

---

## 🗄️ Database Changes

### Schema Migration
```sql
BEGIN;

-- Add is_attendee column to event_attendees
ALTER TABLE event_attendees 
ADD COLUMN is_attendee BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN event_attendees.is_attendee IS 
  'TRUE = User is attending (blocks calendar), FALSE = User is viewing only';

-- Create index for performance on attendee queries
CREATE INDEX idx_event_attendees_is_attendee 
ON event_attendees(event_id, is_attendee) 
WHERE is_attendee = true;

COMMIT;
```

### Migration Strategy for Existing Data

**Recommended: Make existing shares "Viewers" (safest approach)**

```sql
BEGIN;

-- Add the column first
ALTER TABLE event_attendees ADD COLUMN is_attendee BOOLEAN DEFAULT false;

-- Step 1: Mark ALL existing records as viewers (false) by default
-- (Already done by DEFAULT false)

-- Step 2: Mark event CREATORS as attendees
-- Event creator should always be attending their own event
UPDATE event_attendees ea
SET is_attendee = true
WHERE ea.user_id = (
  SELECT e.user_id 
  FROM events e 
  WHERE e.id = ea.event_id
);

-- Step 3: Add creator as attendee if not already in table
-- This ensures every event has at least the creator as an attendee
INSERT INTO event_attendees (event_id, user_id, is_attendee)
SELECT e.id, e.user_id, true
FROM events e
WHERE NOT EXISTS (
  SELECT 1 FROM event_attendees ea 
  WHERE ea.event_id = e.id AND ea.user_id = e.user_id
);

COMMIT;
```

**Result after migration:**
- Event creators → Attendees (blocks their calendar) ✅
- All other shared users → Viewers (doesn't block) ✅
- Users can manually promote viewers to attendees via UI

**Alternative Migration Strategy (if needed):**
If user feedback suggests existing shares should remain as attendees:
```sql
-- Mark ALL existing records as attendees instead
UPDATE event_attendees SET is_attendee = true;
```

---

## 🎨 UI/UX Changes

### 1. Event Creation/Edit Form

**Current State:**
```tsx
{/* Single section - all users block calendar */}
<div>
  <Label>Attendees</Label>
  <UserMultiSelect 
    selectedUsers={attendees}
    onChange={setAttendees}
  />
</div>
```

**Proposed New UI:**
```tsx
{/* Section 1: Attendees (blocks calendar) */}
<div className="space-y-2">
  <div className="flex items-center gap-2">
    <Users className="w-4 h-4 text-primary" />
    <Label>Attendees</Label>
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <HelpCircle className="w-3 h-3 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">People attending this event.<br/>Blocks their calendar.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
  
  {/* User selection list with attendee checkmarks */}
  <div className="space-y-1">
    {relationships.map((rel) => (
      <button
        key={rel.id}
        type="button"
        onClick={() => toggleAttendee(rel.profile.id, true)}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
          attendees.includes(rel.profile.id)
            ? "bg-primary/10 border-l-4 border-primary"
            : "bg-card hover:bg-accent"
        )}
      >
        <Users className="w-4 h-4 text-primary" />
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: rel.profile.calendar_color }}
        />
        <span className="flex-1 text-left text-sm">
          {rel.profile.display_name}
        </span>
        {attendees.includes(rel.profile.id) && (
          <Check className="w-4 h-4 text-primary" />
        )}
      </button>
    ))}
  </div>
</div>

{/* Section 2: Viewers (visibility only) */}
<div className="space-y-2 mt-4">
  <div className="flex items-center gap-2">
    <Eye className="w-4 h-4 text-muted-foreground" />
    <Label className="text-muted-foreground">Shared with (Viewers)</Label>
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <HelpCircle className="w-3 h-3 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">People who can see this event.<br/>Doesn't block their calendar.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
  
  {/* User selection list with viewer eye icons */}
  <div className="space-y-1">
    {relationships.map((rel) => (
      <button
        key={rel.id}
        type="button"
        onClick={() => toggleViewer(rel.profile.id)}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
          viewers.includes(rel.profile.id)
            ? "bg-muted border-l-4 border-muted-foreground"
            : "bg-card hover:bg-accent"
        )}
      >
        <Eye className="w-4 h-4 text-muted-foreground" />
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: rel.profile.calendar_color }}
        />
        <span className="flex-1 text-left text-sm">
          {rel.profile.display_name}
        </span>
        {viewers.includes(rel.profile.id) && (
          <Check className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
    ))}
  </div>
</div>

{/* Quick convert option */}
<div className="mt-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
  <p>💡 Tip: Add people as <strong>Viewers</strong> to share your schedule without blocking their calendar.</p>
</div>
```

**Visual Distinction:**
- **Attendees:** Blue accent, Users icon, "Blocks calendar" badge
- **Viewers:** Gray accent, Eye icon, "View only" badge
- Color-coded borders: Primary for attendees, muted for viewers

### 2. Calendar Display

**Event Card Visual Updates:**
```tsx
{/* Show attendee/viewer status */}
<EventCard event={event}>
  {/* If user is creator */}
  {event.user_id === currentUser.id && (
    <Badge variant="default" className="text-xs">
      <Calendar className="w-3 h-3 mr-1" />
      Your Event
    </Badge>
  )}
  
  {/* If user is attendee */}
  {event.attendees?.some(a => a.user_id === currentUser.id && a.is_attendee) && (
    <Badge variant="default" className="text-xs">
      <Users className="w-3 h-3 mr-1" />
      Attending
    </Badge>
  )}
  
  {/* If user is viewer only */}
  {event.attendees?.some(a => a.user_id === currentUser.id && !a.is_attendee) && (
    <Badge variant="secondary" className="text-xs opacity-70">
      <Eye className="w-3 h-3 mr-1" />
      Viewing
    </Badge>
  )}
</EventCard>
```

**Calendar Grid Styling:**
- **Own events:** Full opacity, primary color
- **Attending:** Full opacity, creator's color, solid border
- **Viewing:** 60% opacity, creator's color, dashed border

### 3. Free Time Finder Updates

**Logic Change (Critical Fix):**
```typescript
// BEFORE: All shared users block calendar
const hasConflict = events.some((event) => {
  const isUserInvolved =
    selectedUsers.includes(event.user_id) ||
    event.attendees?.some((attendeeId) => selectedUsers.includes(attendeeId));
  
  return isUserInvolved && /* time overlap */;
});

// AFTER: Only attendees block calendar
const hasConflict = events.some((event) => {
  const isUserAttending =
    selectedUsers.includes(event.user_id) || // Creator always attending
    event.attendees?.some((a) => 
      selectedUsers.includes(a.user_id) && a.is_attendee === true
    );
  
  return isUserAttending && /* time overlap */;
});
```

---

## 🔧 Implementation Plan

### Phase 1: Database (30 min)
**Priority: CRITICAL - Do this first**

1. **Run migration script:**
   ```sql
   -- Add column and migrate data (see "Database Changes" above)
   ```

2. **Update RLS policies (if needed):**
   ```sql
   -- Check if policies need updates for is_attendee column
   -- Likely no changes needed as policies are on table level
   ```

3. **Verify migration:**
   ```sql
   -- Check creator is marked as attendee
   SELECT 
     e.title,
     ea.user_id,
     ea.is_attendee,
     e.user_id as creator_id,
     (ea.user_id = e.user_id) as is_creator
   FROM events e
   JOIN event_attendees ea ON ea.event_id = e.id
   LIMIT 20;
   ```

### Phase 2: Backend Types (15 min)
**Files to update:**

**`src/lib/supabase.ts`**
```typescript
// Update EventAttendee type
export type EventAttendee = {
  id: string;
  event_id: string;
  user_id: string;
  is_attendee: boolean; // NEW
  created_at: string;
};

// Update EventWithAttendees interface
export interface EventWithAttendees extends Event {
  attendees?: Array<{
    user_id: string;
    is_attendee: boolean; // NEW
  }>;
  creator_name?: string;
  creator_color?: string;
}
```

### Phase 3: Data Fetching (30 min)
**Files to update:**

**`src/hooks/useEvents.ts`**
```typescript
// Update query to include is_attendee
const { data: attendees } = await supabase
  .from('event_attendees')
  .select('user_id, is_attendee') // ADD is_attendee
  .eq('event_id', event.id);

return {
  ...event,
  attendees: attendees?.map((a) => ({
    user_id: a.user_id,
    is_attendee: a.is_attendee, // NEW
  })) || [],
  // ...
};
```

### Phase 4: UI Updates (1-2 hours)
**Files to update:**

**`src/pages/CreateEvent.tsx`**
1. Add state: `const [viewers, setViewers] = useState<string[]>([]);`
2. Split UI into two sections (attendees + viewers)
3. Update save logic to include `is_attendee` flag:
   ```typescript
   const attendeeRecords = [
     // Creator is always attendee
     { event_id: newEvent.id, user_id: user.id, is_attendee: true },
     // Attendees
     ...attendees.map((userId) => ({
       event_id: newEvent.id,
       user_id: userId,
       is_attendee: true, // NEW
     })),
     // Viewers
     ...viewers.map((userId) => ({
       event_id: newEvent.id,
       user_id: userId,
       is_attendee: false, // NEW
     })),
   ];
   ```

**`src/components/calendar/EventCard.tsx`**
1. Add visual badges for attendee/viewer status
2. Use opacity/styling to distinguish

### Phase 5: Free Time Logic (30 min)
**Files to update:**

**`src/pages/FreeTimeFinder.tsx`**
```typescript
// Update isTimeSlotFree function
const isUserInvolved =
  selectedUsers.includes(event.user_id) || // Creator always blocks
  event.attendees?.some((a) => 
    selectedUsers.includes(a.user_id) && a.is_attendee === true // Only attendees block
  );
```

### Phase 6: Testing (30 min)
1. Create new event with attendees and viewers
2. Verify Free Time Finder only blocks attendees
3. Verify calendar display shows correct badges
4. Test editing existing events
5. Test migration worked (old events have creator as attendee)

---

## ⚠️ Risk Assessment

### Low Risk
- ✅ **Backward compatible** - Default value ensures no breaking changes
- ✅ **Rollback easy** - Can drop column if needed
- ✅ **Data integrity** - Migration script ensures creator is always attendee

### Medium Risk
- ⚠️ **User confusion** - Need clear UI to explain attendee vs viewer
  - **Mitigation:** Tooltips, help text, visual distinction
- ⚠️ **Existing shared events** - All become viewers after migration
  - **Mitigation:** Clearly communicate change to users, easy to promote to attendee

### Testing Checklist
- [ ] Database migration runs successfully
- [ ] Existing events still load correctly
- [ ] New events can be created with attendees + viewers
- [ ] Free Time Finder correctly ignores viewers
- [ ] Calendar display shows correct badges
- [ ] Event editing preserves attendee/viewer status
- [ ] RLS policies work correctly

---

## 📈 Expected Outcomes

### After Implementation

**✅ Attendees:**
- Event blocks their calendar ⏰
- Shows in Free Time Finder as busy 🔴
- Clearly marked as "Attending" in UI 👥
- Can see full event details 📄

**✅ Viewers:**
- Can see event details 👁️
- Does NOT block their calendar ✅
- Shows in Free Time Finder as available 🟢
- Clearly marked as "Viewing" in UI 📋
- Can be promoted to attendee easily 🔄

### Use Cases Solved

1. **Manager shares meeting with team**
   - Team members are **viewers** (can see it, not attending)
   - Only actual participants are **attendees** (calendar blocked)

2. **Vacation notification**
   - Colleagues are **viewers** (informed, but still available)
   - User is **attendee** (vacation blocks their calendar)

3. **Client meeting**
   - Client is **attendee** (attending, blocks calendar)
   - Internal team observers are **viewers** (informed, still available)

4. **Conference attendance**
   - Attendees block calendar for conference
   - Colleagues back at office are viewers (aware, still available)

---

## ❓ Questions for User Approval

Please confirm the following before implementation:

### 1. Database Approach ✓
**Recommendation: Option A (Add is_attendee boolean)**
- [ ] Approved
- [ ] Prefer Option B (separate tables) - explain why:

### 2. Migration Strategy ✓
**Recommendation: Existing shares become viewers (safer)**
- [ ] Approved - Make existing shares "Viewers"
- [ ] Alternative - Make existing shares "Attendees"
- [ ] Custom approach - explain:

### 3. Default Behavior ✓
**When sharing an event, default should be:**
- [ ] Viewer (recommended - less intrusive)
- [ ] Attendee (more traditional)
- [ ] Ask user each time

### 4. Creator Auto-Attendance ✓
**Should event creator always be marked as attendee?**
- [ ] Yes (recommended - creator is always attending their own event)
- [ ] No - allow creator to be just a viewer

### 5. Visual Distinction ✓
**Should attendee/viewer events look different in calendar?**
- [ ] Yes (recommended - different opacity/borders)
- [ ] No - keep same styling
- [ ] Custom approach:

### 6. Additional Features
**Would you like any of these additions?**
- [ ] "Promote viewer to attendee" quick action
- [ ] "Demote attendee to viewer" quick action
- [ ] Bulk convert all viewers to attendees
- [ ] Notification when promoted from viewer to attendee

---

## 📝 Implementation Estimate

| Phase | Time | Priority |
|-------|------|----------|
| Database migration | 30 min | P0 - Critical |
| Type updates | 15 min | P1 - High |
| Data fetching | 30 min | P1 - High |
| UI updates | 1-2 hrs | P2 - High |
| Free Time logic | 30 min | P0 - Critical |
| Testing | 30 min | P1 - High |
| **TOTAL** | **3-4 hrs** | - |

---

## 🎯 Next Steps

**After user approval:**

1. ✅ Run database migration script
2. ✅ Update TypeScript types
3. ✅ Update data fetching queries
4. ✅ Update CreateEvent UI (split attendees/viewers)
5. ✅ Update Free Time Finder logic
6. ✅ Update calendar display styling
7. ✅ Test all features end-to-end
8. ✅ Deploy and monitor

---

## 📚 Appendix

### A. SQL Queries for Verification

```sql
-- Check attendee distribution
SELECT 
  is_attendee,
  COUNT(*) as count
FROM event_attendees
GROUP BY is_attendee;

-- Find events with no attendees (should be 0)
SELECT e.id, e.title
FROM events e
WHERE NOT EXISTS (
  SELECT 1 FROM event_attendees ea
  WHERE ea.event_id = e.id AND ea.is_attendee = true
);

-- Check creator attendance
SELECT 
  e.title,
  e.user_id as creator_id,
  ea.user_id as attendee_id,
  ea.is_attendee
FROM events e
JOIN event_attendees ea ON ea.event_id = e.id
WHERE e.user_id = ea.user_id
LIMIT 10;
```

### B. Rollback Plan

If needed, rollback with:
```sql
BEGIN;

-- Remove the column
ALTER TABLE event_attendees DROP COLUMN is_attendee;

-- Drop the index
DROP INDEX IF EXISTS idx_event_attendees_is_attendee;

COMMIT;
```

### C. Future Enhancements

**Not in scope for this task, but possible future additions:**
- Response status (accepted/declined/tentative)
- Email notifications for attendee changes
- Calendar invites (iCal format)
- Attendee-specific notes
- Meeting role (organizer/required/optional)

---

**END OF PROPOSAL**

---

**Status:** ⏸️ AWAITING USER APPROVAL  
**Contact:** Reply with approved or questions/changes needed

