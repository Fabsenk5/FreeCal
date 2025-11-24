# 📋 PLANNING: Attendees vs Viewers Feature

**Status:** ⏸️ AWAITING USER APPROVAL  
**Created:** 2025-11-24  
**Estimated Implementation:** 3-4 hours

---

## 📌 Quick Summary

This planning package contains everything needed to implement the separation of event attendees from viewers. **No code has been implemented yet** - this is purely a proposal for your review and approval.

---

## 🎯 What's the Problem?

Currently, when you share an event with someone in FreeCal, it **incorrectly blocks their calendar**. This is wrong because:

- Sharing your vacation with colleagues shouldn't block their time
- Informing your team about a client meeting shouldn't make them unavailable
- Viewing someone's schedule ≠ attending their event

**Current behavior:**
```
You create "Client Meeting 2-3pm"
├─ Share with Alice
└─ ❌ Alice's calendar shows 2-3pm as BLOCKED (wrong!)
```

**Desired behavior:**
```
You create "Client Meeting 2-3pm"
├─ Add Alice as ATTENDEE → ✅ Blocks her calendar
└─ Share with Bob as VIEWER → ✅ He can see it but remains available
```

---

## ✅ Proposed Solution

Add a single boolean column `is_attendee` to the existing `event_attendees` table:

- `is_attendee = true` → **Attendee** (blocks calendar)
- `is_attendee = false` → **Viewer** (informational only)

**Why this approach?**
- ✅ Simple - just one column
- ✅ Minimal code changes
- ✅ Backward compatible
- ✅ Easy to understand
- ✅ Fast to implement (~3-4 hours)

---

## 📚 Documentation Provided

### 1️⃣ **PROPOSAL_ATTENDEES_VS_VIEWERS.md** (Main Document)
**What's inside:**
- Complete technical proposal
- Two database approach options (A recommended, B alternative)
- SQL migration script (ready to run)
- Migration strategy for existing data
- UI/UX mockups with code examples
- Risk assessment
- 6 questions for your approval

**Read this first!**

### 2️⃣ **UI_MOCKUPS_ATTENDEES_VIEWERS.md** (Visual Reference)
**What's inside:**
- Before/after UI comparisons
- Wireframes for event creation form
- Calendar display examples
- Free Time Finder visuals
- Mobile considerations
- Color coding reference

**Great for visualizing the changes!**

### 3️⃣ **IMPLEMENTATION_CHECKLIST.md** (Developer Guide)
**What's inside:**
- Step-by-step implementation tasks
- File-by-file code changes
- SQL verification queries
- Testing procedures
- Deployment checklist
- Rollback plan

**Your roadmap for implementation!**

---

## ❓ Questions You Need to Answer

Before implementation can begin, please review the proposal and answer these 6 questions:

### 1. Database Approach
**Recommendation:** Option A (add `is_attendee` boolean)
- [ ] Approved
- [ ] Prefer Option B (separate tables) - explain why:

### 2. Migration Strategy  
**Recommendation:** Make existing shares "Viewers" (safer)
- [ ] Approved - Existing shares become viewers
- [ ] Alternative - Existing shares become attendees
- [ ] Custom approach - explain:

### 3. Default Behavior
**When sharing an event, default should be:**
- [ ] Viewer (recommended - less intrusive)
- [ ] Attendee (more traditional)
- [ ] Ask user each time

### 4. Creator Auto-Attendance
**Should event creator always be marked as attendee?**
- [ ] Yes (recommended - creator is always attending their own event)
- [ ] No - allow creator to be just a viewer

### 5. Visual Distinction
**Should attendee/viewer events look different in calendar?**
- [ ] Yes (recommended - different opacity/borders)
- [ ] No - keep same styling

### 6. Additional Features
**Would you like any of these?**
- [ ] "Promote viewer to attendee" quick action
- [ ] "Demote attendee to viewer" quick action
- [ ] Bulk convert actions
- [ ] Notification when status changes

---

## 🎨 Visual Preview

### Event Creation Form (Proposed)
```
┌─────────────────────────────────────┐
│ 👥 Attendees                        │
│ (Blocks their calendar)             │
├─────────────────────────────────────┤
│ ✓ Alice Johnson                     │  ← Solid blue border
│   Bob Smith                         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 👁️  Shared with (Viewers)           │
│ (View only, doesn't block)          │
├─────────────────────────────────────┤
│ ✓ Carol Davis                       │  ← Dashed gray border
│   Dave Wilson                       │
└─────────────────────────────────────┘
```

### Calendar Display
- **Your events:** 📅 "Your Event" badge
- **Attending:** 👥 "Attending" badge (full opacity)
- **Viewing:** 👁️ "Viewing" badge (60% opacity, dashed border)

---

## 📈 Impact Analysis

### Database
- ✅ One column added
- ✅ One index created
- ✅ Migration script ready
- ⚠️ ~30 minutes estimated

### Frontend
- 🔧 4 files to update
- 🔧 Split UI into two sections
- 🔧 Update Free Time Finder logic
- ⚠️ ~2-3 hours estimated

### Testing
- 🧪 Manual testing scenarios provided
- 🧪 Verification queries included
- ⚠️ ~30 minutes estimated

---

## 🚀 Implementation Timeline

If approved today:

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Database** | 30 min | Run migration, verify data |
| **Types** | 15 min | Update TypeScript interfaces |
| **Data fetching** | 30 min | Update queries to include `is_attendee` |
| **UI updates** | 1-2 hrs | Split form, add badges, styling |
| **Free Time logic** | 30 min | Fix blocking logic (critical!) |
| **Testing** | 30 min | Manual testing, verification |
| **TOTAL** | **3-4 hrs** | Ready to deploy! |

---

## ✅ What Happens After Approval?

1. **Database migration runs** (adds `is_attendee` column)
2. **Existing data migrated:**
   - Event creators → Marked as attendees ✅
   - All other shared users → Marked as viewers ✅
3. **Frontend updated:**
   - Event form gets two sections
   - Free Time Finder respects attendee/viewer
   - Calendar shows badges
4. **Testing completed**
5. **Feature goes live! 🎉**

---

## 🛡️ Safety & Rollback

**Is it safe?**
- ✅ Backward compatible (default value prevents breaks)
- ✅ Non-destructive migration (no data deleted)
- ✅ Easy to rollback (drop column if needed)
- ✅ Tested migration script included

**Rollback plan:**
```sql
-- Emergency rollback (if needed)
ALTER TABLE event_attendees DROP COLUMN is_attendee;
```

---

## 💡 Key Benefits

After implementation:

### For Event Creators
- ✅ Can share schedule without blocking others
- ✅ Clear distinction between attendees and viewers
- ✅ More flexible event sharing options

### For Event Viewers
- ✅ Can see shared events
- ✅ Calendar remains unblocked (stays available)
- ✅ Free Time Finder shows correct availability

### For Attendees
- ✅ Calendar properly blocked during events
- ✅ Shows as busy in Free Time Finder
- ✅ Clear visual indication of attendance

---

## 📞 Next Steps

### To Approve:
1. **Read** `PROPOSAL_ATTENDEES_VS_VIEWERS.md`
2. **Review** `UI_MOCKUPS_ATTENDEES_VIEWERS.md` for visuals
3. **Answer** the 6 questions above
4. **Reply** with your approval and answers
5. **Implementation begins!** 🚀

### To Request Changes:
- Reply with specific changes needed
- Ask questions about any unclear points
- Suggest alternative approaches
- Request additional mockups/examples

### To Reject:
- Let me know why
- Suggest alternative solutions
- Discuss concerns

---

## 📊 Files in This Package

```
.threads/c3bd8ba7/
├── README_PLANNING.md                    ← You are here
├── PROPOSAL_ATTENDEES_VS_VIEWERS.md      ← Main proposal (read first!)
├── UI_MOCKUPS_ATTENDEES_VIEWERS.md       ← Visual mockups
└── IMPLEMENTATION_CHECKLIST.md           ← Developer guide
```

---

## ⭐ Recommendation

**I recommend approving this proposal because:**

1. ✅ **Simple solution** - Just one boolean column
2. ✅ **Low risk** - Backward compatible, easy rollback
3. ✅ **High impact** - Fixes major UX issue
4. ✅ **Fast implementation** - 3-4 hours total
5. ✅ **Well planned** - Complete documentation provided
6. ✅ **User-friendly** - Clear UI distinction

**Default answers I recommend:**
1. Database approach: **Option A** (boolean column)
2. Migration: **Existing → Viewers** (safer)
3. Default behavior: **Viewer** (less intrusive)
4. Creator attendance: **Yes, always** (makes sense)
5. Visual distinction: **Yes** (clearer for users)
6. Additional features: **Not needed initially** (keep it simple)

---

## 🎯 Ready to Proceed?

Reply with:
- "Approved" (to proceed with recommendations)
- "Approved with changes: [your answers]" (to customize)
- "I have questions about: [topic]" (to discuss)
- "Hold off, let me review more" (to take your time)

---

**Thank you for reviewing this proposal!**

All planning documents are ready. Just awaiting your approval to begin implementation. 🚀

---

**Status:** ⏸️ AWAITING USER APPROVAL  
**Last Updated:** 2025-11-24
