# Architecture Documentation

## System Overview

FreeCal is a React-based calendar application with Altan Cloud backend (PostgreSQL + Auth).

## Database Schema

### profiles

Extends Altan Auth users.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  calendar_color TEXT NOT NULL DEFAULT 'hsl(217, 91%, 60%)',
  is_approved BOOLEAN DEFAULT false,
  approval_status TEXT CHECK (approval_status IN ('pending','approved','rejected')) DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS Policies:**
- Users can read own profile
- Users can read profiles of accepted relationships
- Users can update own profile

### relationships

User connections (partners/family).

```sql
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  related_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status relationship_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, related_user_id),
  CHECK(user_id != related_user_id)
);
```

**Status enum:** `pending | accepted | rejected`

**RLS Policies:**
- Users can read their own relationships (both directions)
- Users can create relationships (self as user_id)
- Users can update/delete own relationships

### events

Calendar events.

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  color TEXT NOT NULL,
  recurrence_rule TEXT,
  recurrence_type recurrence_type DEFAULT 'none',
  recurrence_days TEXT[],
  recurrence_interval INT,
  recurrence_end_date TIMESTAMPTZ,
  imported_from_device BOOLEAN DEFAULT false,
  location TEXT,
  url TEXT,
  is_tentative BOOLEAN,
  alerts JSONB[],
  travel_time TEXT,
  original_calendar_id TEXT,
  attendees JSONB[],
  structured_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK(end_time > start_time)
);
```

**Recurrence types:** `none | daily | weekly | monthly | custom`

**RLS Policies:**
- Users can read own events
- Users can read events where they are attendees or viewers
- Users can create events (self as user_id)
- Users can update/delete own events only

### event_attendees (Attendees)

Users attending events (blocks their calendar).

```sql
CREATE TABLE event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);
```

**RLS Policies:**
- Users can read attendees of events they can access
- Event owners can manage attendees

### event_viewers

Users who can view events (doesn't block calendar).

```sql
CREATE TABLE event_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);
```

**RLS Policies:**
- Event owner can see viewers
- Viewer themselves can see
- Attendees can see viewers
- Only event owner can add/remove viewers

## Frontend Architecture

### Authentication Flow

1. User visits app → Check auth state
2. Not authenticated → Redirect to `/login`
3. Authenticated but not approved → Redirect to `/pending-approval`
4. Authenticated + approved → Access app
5. Admin (fabiank5@hotmail.com) → Full access always

**Implementation:** `src/contexts/AuthContext.tsx` + `src/components/auth/ProtectedRoute.tsx`

### State Management

**Auth State:** React Context (`AuthContext`)
- Current user
- Session
- Profile
- Sign in/out methods

**Data Fetching:** Custom hooks
- `useEvents()` - Fetches events (own + attended + viewed)
- `useRelationships()` - Fetches accepted relationships
- `useRelationshipRequests()` - Fetches pending requests

### Component Patterns

**Page Components:** `src/pages/`
- Full-page views
- Data fetching at page level
- Route-mapped

**Feature Components:** `src/components/{feature}/`
- Domain-specific logic
- Reusable within feature

**UI Components:** `src/components/ui/`
- Design system (shadcn/ui)
- No business logic
- Highly reusable

### Naming Conventions

**Files:**
- Components: PascalCase (e.g., `CalendarView.tsx`)
- Hooks: camelCase with "use" prefix (e.g., `useEvents.ts`)
- Utils: camelCase (e.g., `dateUtils.ts`)
- Types: PascalCase (e.g., `types.ts`)

**Database:**
- Tables: snake_case plural (e.g., `event_attendees`)
- Columns: snake_case (e.g., `user_id`, `created_at`)
- Enums: snake_case (e.g., `relationship_status`)

**TypeScript:**
- Interfaces: PascalCase (e.g., `Profile`, `Event`)
- Types: PascalCase (e.g., `Database`, `RelationshipStatus`)
- Enums: PascalCase (e.g., `RecurrenceType`)

## Data Flow

### Event Creation

1. User fills form (`CreateEvent.tsx`)
2. Form submission → Insert into `events` table
3. Add attendees → Insert into `event_attendees`
4. Add viewers → Insert into `event_viewers`
5. Refresh events via `useEvents()`
6. Calendar updates automatically

### Free Time Calculation

1. Select users in Free Time Finder
2. Fetch all events for selected users
3. Filter events where users are attendees (not viewers!)
4. Calculate gaps in schedules
5. Display free slots

**Key Logic:** Only `event_attendees` block time, not `event_viewers`

### Relationship Flow

1. User A adds User B by email
2. Insert into `relationships` with `status='pending'`
3. User B sees request (modal on login)
4. User B accepts → Update `status='accepted'`
5. Both users can now see each other's calendars

## Security

### Row Level Security (RLS)

All tables have RLS enabled. Users can only:
- Read their own data
- Read data of accepted relationships
- Modify their own data
- Event owners control attendees/viewers

### Admin Bypass

Admin user (`fabiank5@hotmail.com`) bypasses approval checks in frontend but respects RLS in database.

## Performance Considerations

**Database Queries:**
- Events query uses single query with joins (not N+1)
- Relationships cached in hook state
- Indexes on foreign keys and frequently queried columns

**Frontend:**
- React Context prevents prop drilling
- Custom hooks memoize data
- Date calculations optimized with date-fns

## External Dependencies

**Altan Cloud:**
- PostgreSQL database (via PostgREST)
- GoTrue authentication
- Connection details in `.env.local`

**No external services required** (yet):
- Email notifications planned but not implemented
- ICS import planned but not implemented

## Deployment

**Build:**
```bash
npm run build
```

**Output:** `dist/` directory (static files)

**Hosting:** Currently on Altan platform, can deploy to:
- Vercel
- Netlify
- Any static hosting

**Environment variables required:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
