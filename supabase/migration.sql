-- FreeCal Supabase Migration
-- This creates the schema in Supabase, using auth.uid() for RLS

-- ============================================================
-- 1. TABLES
-- ============================================================

-- Profiles table (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    calendar_color TEXT NOT NULL DEFAULT 'hsl(217, 91%, 60%)',
    is_approved BOOLEAN DEFAULT FALSE,
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_at TIMESTAMPTZ,
    approved_by UUID,
    is_admin BOOLEAN DEFAULT FALSE,
    needs_password_reset BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relationships table
CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    related_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, related_user_id)
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN DEFAULT FALSE,
    color TEXT NOT NULL,
    recurrence_rule TEXT,
    recurrence_type TEXT DEFAULT 'none' CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly', 'custom')),
    recurrence_days TEXT[],
    recurrence_interval INTEGER,
    recurrence_end_date TIMESTAMPTZ,
    recurrence_exceptions TEXT[],
    imported_from_device BOOLEAN DEFAULT FALSE,
    location TEXT,
    url TEXT,
    is_tentative BOOLEAN,
    alerts JSONB[],
    travel_time TEXT,
    original_calendar_id TEXT,
    attendees JSONB[],
    structured_metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Attendees table
CREATE TABLE IF NOT EXISTS event_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    is_attendee BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- Event Viewers table
CREATE TABLE IF NOT EXISTS event_viewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

-- Feature Wishes table
CREATE TABLE IF NOT EXISTS feature_wishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Travel Locations table (World Map)
CREATE TABLE IF NOT EXISTS travel_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    latitude TEXT NOT NULL,
    longitude TEXT NOT NULL,
    country TEXT,
    city TEXT,
    visited_date TIMESTAMPTZ,
    with_relationship_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_wishlist BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_locations ENABLE ROW LEVEL SECURITY;

-- === PROFILES ===
-- Users can read all profiles (needed for search, attendee display)
CREATE POLICY "profiles_select_all" ON profiles
    FOR SELECT TO authenticated USING (true);

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Admins can update any profile
CREATE POLICY "profiles_admin_update" ON profiles
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Admins can delete profiles
CREATE POLICY "profiles_admin_delete" ON profiles
    FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- Profile is auto-created on signup via trigger (INSERT handled by trigger)
CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- === RELATIONSHIPS ===
CREATE POLICY "relationships_select_own" ON relationships
    FOR SELECT TO authenticated USING (
        auth.uid() = user_id OR auth.uid() = related_user_id
    );

CREATE POLICY "relationships_insert_own" ON relationships
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "relationships_update_recipient" ON relationships
    FOR UPDATE TO authenticated USING (auth.uid() = related_user_id);

CREATE POLICY "relationships_delete_own" ON relationships
    FOR DELETE TO authenticated USING (
        auth.uid() = user_id OR auth.uid() = related_user_id
    );

-- === EVENTS ===
-- Users can see events they own, are attendee of, or viewer of
CREATE POLICY "events_select_own_or_invited" ON events
    FOR SELECT TO authenticated USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM event_attendees WHERE event_id = events.id AND user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM event_viewers WHERE event_id = events.id AND user_id = auth.uid())
    );

CREATE POLICY "events_insert_own" ON events
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "events_update_own" ON events
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "events_delete_own" ON events
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- === EVENT ATTENDEES ===
CREATE POLICY "event_attendees_select" ON event_attendees
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM events WHERE id = event_attendees.event_id AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM event_attendees ea WHERE ea.event_id = event_attendees.event_id AND ea.user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM event_viewers ev WHERE ev.event_id = event_attendees.event_id AND ev.user_id = auth.uid())
        ))
    );

-- Event creator can manage attendees
CREATE POLICY "event_attendees_insert" ON event_attendees
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM events WHERE id = event_attendees.event_id AND user_id = auth.uid())
    );

CREATE POLICY "event_attendees_update" ON event_attendees
    FOR UPDATE TO authenticated USING (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM events WHERE id = event_attendees.event_id AND user_id = auth.uid())
    );

CREATE POLICY "event_attendees_delete" ON event_attendees
    FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM events WHERE id = event_attendees.event_id AND user_id = auth.uid())
    );

-- === EVENT VIEWERS ===
CREATE POLICY "event_viewers_select" ON event_viewers
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM events WHERE id = event_viewers.event_id AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM event_attendees ea WHERE ea.event_id = event_viewers.event_id AND ea.user_id = auth.uid())
            OR EXISTS (SELECT 1 FROM event_viewers ev WHERE ev.event_id = event_viewers.event_id AND ev.user_id = auth.uid())
        ))
    );

CREATE POLICY "event_viewers_insert" ON event_viewers
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM events WHERE id = event_viewers.event_id AND user_id = auth.uid())
    );

CREATE POLICY "event_viewers_delete" ON event_viewers
    FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM events WHERE id = event_viewers.event_id AND user_id = auth.uid())
    );

-- === FEATURE WISHES ===
CREATE POLICY "feature_wishes_select_all" ON feature_wishes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "feature_wishes_insert_auth" ON feature_wishes
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- Admin-only update/delete
CREATE POLICY "feature_wishes_update_admin" ON feature_wishes
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

CREATE POLICY "feature_wishes_delete_admin" ON feature_wishes
    FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
    );

-- === TRAVEL LOCATIONS ===
CREATE POLICY "travel_locations_select_own_or_tagged" ON travel_locations
    FOR SELECT TO authenticated USING (
        auth.uid() = user_id OR auth.uid() = with_relationship_id
    );

CREATE POLICY "travel_locations_insert_own" ON travel_locations
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "travel_locations_update_own" ON travel_locations
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "travel_locations_delete_own" ON travel_locations
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 3. AUTO-CREATE PROFILE ON SIGNUP (Trigger)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 4. AUTO-UPDATE updated_at TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_relationships_updated_at BEFORE UPDATE ON relationships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_travel_locations_updated_at BEFORE UPDATE ON travel_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
