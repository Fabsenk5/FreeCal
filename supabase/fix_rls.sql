-- Supabase Infinite Recursion RLS Fix
-- 1. Create a security definer function to return all accessible event IDs for a given user
CREATE OR REPLACE FUNCTION get_accessible_events(uid UUID)
RETURNS SETOF UUID AS $$
    SELECT id FROM events WHERE user_id = uid
    UNION
    SELECT event_id FROM event_attendees WHERE user_id = uid
    UNION
    SELECT event_id FROM event_viewers WHERE user_id = uid;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 2. Drop the recursive select policies
DROP POLICY IF EXISTS "events_select_own_or_invited" ON events;
DROP POLICY IF EXISTS "event_attendees_select" ON event_attendees;
DROP POLICY IF EXISTS "event_viewers_select" ON event_viewers;

-- 3. Recreate them using the function
CREATE POLICY "events_select_own_or_invited" ON events
    FOR SELECT TO authenticated USING (
        id IN (SELECT get_accessible_events(auth.uid()))
    );

CREATE POLICY "event_attendees_select" ON event_attendees
    FOR SELECT TO authenticated USING (
        event_id IN (SELECT get_accessible_events(auth.uid()))
    );

CREATE POLICY "event_viewers_select" ON event_viewers
    FOR SELECT TO authenticated USING (
        event_id IN (SELECT get_accessible_events(auth.uid()))
    );
