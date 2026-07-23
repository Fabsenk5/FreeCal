-- ============================================================
-- FreeCal Security Hardening Migration
-- ============================================================
-- Idempotent: safe to run multiple times in the Supabase SQL Editor.
-- Contains only policies, functions and triggers. No table drops,
-- no data modifications.
--
-- Sections:
--   S1  - Protect privileged profile columns from self-escalation
--   S3  - Enforce approval status in RLS on core tables
--   S7  - Restrict get_accessible_events() to the caller's own uid
--   S8  - RLS for push_subscriptions, event_comments, event_checklists
--   R15 - Race-free recurrence exception RPC
--   V   - Verification queries (commented out)
-- ============================================================

BEGIN;

-- ============================================================
-- S1 - Protect privileged profile columns from self-escalation
-- ============================================================
-- Problem: policy "profiles_update_own" (FOR UPDATE USING auth.uid() = id)
-- allowed every user to set is_admin / is_approved / approval_status /
-- approved_by / approved_at / needs_password_reset on their own row
-- (self-admin + self-approval).
--
-- Fix:
--   a) SECURITY DEFINER helper is_admin_user() that checks admin status
--      without tripping RLS (a plain subquery on profiles inside a policy
--      or trigger would be subject to RLS / infinite recursion).
--   b) BEFORE UPDATE trigger that rejects changes to the privileged columns
--      for non-admins.
--   c) Tightened "profiles_insert_own" WITH CHECK so non-admins can only
--      insert their own row with the privileged defaults.
--
-- Signup path is NOT broken: the profile row is created by the
-- handle_new_user() trigger (SECURITY DEFINER, runs as function owner,
-- bypasses RLS), so the INSERT policy is never evaluated for signup.

-- a) Shared admin-check helper (reused by later sections).
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- b) Trigger function: non-admins may not modify privileged columns.
--    SECURITY DEFINER so the admin check on profiles is not blocked by RLS.
CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Server-side access (service role key, direct DB connections such as
    -- the Express backend) carries no JWT, so auth.uid() is NULL. RLS does
    -- not apply there either; allow the update.
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Admins may change privileged columns on any profile.
    IF EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    ) THEN
        RETURN NEW;
    END IF;

    -- Non-admins may not change these columns, not even on their own row.
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
        OR NEW.is_approved IS DISTINCT FROM OLD.is_approved
        OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
        OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
        OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
        OR NEW.needs_password_reset IS DISTINCT FROM OLD.needs_password_reset
    THEN
        RAISE EXCEPTION 'insufficient privilege: only admins can modify admin/approval fields';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger functions must not be callable directly.
REVOKE ALL ON FUNCTION public.protect_profile_admin_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS protect_profile_admin_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_admin_fields_trigger
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_fields();

-- c) Tightened insert policy: non-admins can only create their own profile
--    with the privileged columns at their safe defaults. Admins (e.g. when
--    creating approved users) may set them explicitly.
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (
        auth.uid() = id
        AND (
            public.is_admin_user()
            OR (
                COALESCE(is_admin, FALSE) = FALSE
                AND COALESCE(is_approved, FALSE) = FALSE
                AND approval_status = 'pending'
                AND approved_by IS NULL
                AND approved_at IS NULL
                AND COALESCE(needs_password_reset, FALSE) = FALSE
            )
        )
    );

-- Also rewrite the admin policies on profiles: the originals referenced the
-- profiles table itself inside the policy expression, which risks
-- "infinite recursion detected in policy" errors. The SECURITY DEFINER
-- helper has identical semantics without the recursion.
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
    FOR UPDATE TO authenticated USING (public.is_admin_user());

DROP POLICY IF EXISTS "profiles_admin_delete" ON public.profiles;
CREATE POLICY "profiles_admin_delete" ON public.profiles
    FOR DELETE TO authenticated USING (public.is_admin_user());

-- ============================================================
-- S3 - Enforce approval status in RLS on core tables
-- ============================================================
-- WARNING: this section locks unapproved users out of all app data on the
-- core tables (events, event_attendees, event_viewers, relationships,
-- travel_locations, feature_wishes). Before running it, make sure the admin
-- account is approved AND admin, otherwise the admin locks itself out.
-- Run this manually (DO NOT uncomment here, execute deliberately):
--
-- UPDATE public.profiles
-- SET is_approved = true,
--     approval_status = 'approved',
--     is_admin = true,
--     approved_at = COALESCE(approved_at, NOW())
-- WHERE email = 'fabiank5@hotmail.com';
--
-- Notes:
--   * The service role (Express backend) bypasses RLS entirely and is
--     unaffected by this change.
--   * The profiles table is intentionally NOT gated on approval: the
--     /pending-approval flow needs to read the user's own profile row to
--     show the approval state.

CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (is_approved = true OR is_admin = true)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_approved_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_approved_user() TO authenticated;

-- === EVENTS ===
DROP POLICY IF EXISTS "events_select_own_or_invited" ON public.events;
CREATE POLICY "events_select_own_or_invited" ON public.events
    FOR SELECT TO authenticated USING (
        public.is_approved_user()
        AND id IN (SELECT public.get_accessible_events(auth.uid()))
    );

DROP POLICY IF EXISTS "events_insert_own" ON public.events;
CREATE POLICY "events_insert_own" ON public.events
    FOR INSERT TO authenticated WITH CHECK (
        public.is_approved_user() AND auth.uid() = user_id
    );

DROP POLICY IF EXISTS "events_update_own" ON public.events;
CREATE POLICY "events_update_own" ON public.events
    FOR UPDATE TO authenticated USING (
        public.is_approved_user() AND auth.uid() = user_id
    );

DROP POLICY IF EXISTS "events_delete_own" ON public.events;
CREATE POLICY "events_delete_own" ON public.events
    FOR DELETE TO authenticated USING (
        public.is_approved_user() AND auth.uid() = user_id
    );

-- === EVENT ATTENDEES ===
DROP POLICY IF EXISTS "event_attendees_select" ON public.event_attendees;
CREATE POLICY "event_attendees_select" ON public.event_attendees
    FOR SELECT TO authenticated USING (
        public.is_approved_user()
        AND event_id IN (SELECT public.get_accessible_events(auth.uid()))
    );

DROP POLICY IF EXISTS "event_attendees_insert" ON public.event_attendees;
CREATE POLICY "event_attendees_insert" ON public.event_attendees
    FOR INSERT TO authenticated WITH CHECK (
        public.is_approved_user()
        AND EXISTS (
            SELECT 1 FROM public.events
            WHERE id = event_attendees.event_id AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "event_attendees_update" ON public.event_attendees;
CREATE POLICY "event_attendees_update" ON public.event_attendees
    FOR UPDATE TO authenticated USING (
        public.is_approved_user()
        AND (
            user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.events
                WHERE id = event_attendees.event_id AND user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "event_attendees_delete" ON public.event_attendees;
CREATE POLICY "event_attendees_delete" ON public.event_attendees
    FOR DELETE TO authenticated USING (
        public.is_approved_user()
        AND EXISTS (
            SELECT 1 FROM public.events
            WHERE id = event_attendees.event_id AND user_id = auth.uid()
        )
    );

-- === EVENT VIEWERS ===
DROP POLICY IF EXISTS "event_viewers_select" ON public.event_viewers;
CREATE POLICY "event_viewers_select" ON public.event_viewers
    FOR SELECT TO authenticated USING (
        public.is_approved_user()
        AND event_id IN (SELECT public.get_accessible_events(auth.uid()))
    );

DROP POLICY IF EXISTS "event_viewers_insert" ON public.event_viewers;
CREATE POLICY "event_viewers_insert" ON public.event_viewers
    FOR INSERT TO authenticated WITH CHECK (
        public.is_approved_user()
        AND EXISTS (
            SELECT 1 FROM public.events
            WHERE id = event_viewers.event_id AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "event_viewers_delete" ON public.event_viewers;
CREATE POLICY "event_viewers_delete" ON public.event_viewers
    FOR DELETE TO authenticated USING (
        public.is_approved_user()
        AND EXISTS (
            SELECT 1 FROM public.events
            WHERE id = event_viewers.event_id AND user_id = auth.uid()
        )
    );

-- === RELATIONSHIPS ===
DROP POLICY IF EXISTS "relationships_select_own" ON public.relationships;
CREATE POLICY "relationships_select_own" ON public.relationships
    FOR SELECT TO authenticated USING (
        public.is_approved_user()
        AND (auth.uid() = user_id OR auth.uid() = related_user_id)
    );

DROP POLICY IF EXISTS "relationships_insert_own" ON public.relationships;
CREATE POLICY "relationships_insert_own" ON public.relationships
    FOR INSERT TO authenticated WITH CHECK (
        public.is_approved_user() AND auth.uid() = user_id
    );

DROP POLICY IF EXISTS "relationships_update_recipient" ON public.relationships;
CREATE POLICY "relationships_update_recipient" ON public.relationships
    FOR UPDATE TO authenticated USING (
        public.is_approved_user() AND auth.uid() = related_user_id
    );

DROP POLICY IF EXISTS "relationships_delete_own" ON public.relationships;
CREATE POLICY "relationships_delete_own" ON public.relationships
    FOR DELETE TO authenticated USING (
        public.is_approved_user()
        AND (auth.uid() = user_id OR auth.uid() = related_user_id)
    );

-- === FEATURE WISHES ===
DROP POLICY IF EXISTS "feature_wishes_select_all" ON public.feature_wishes;
CREATE POLICY "feature_wishes_select_all" ON public.feature_wishes
    FOR SELECT TO authenticated USING (public.is_approved_user());

DROP POLICY IF EXISTS "feature_wishes_insert_auth" ON public.feature_wishes;
CREATE POLICY "feature_wishes_insert_auth" ON public.feature_wishes
    FOR INSERT TO authenticated WITH CHECK (
        public.is_approved_user() AND auth.uid() = created_by
    );

-- Admin-only update/delete. is_admin_user() already implies approval
-- (see is_approved_user()); the helper replaces the previous inline
-- profiles subquery, which was subject to RLS.
DROP POLICY IF EXISTS "feature_wishes_update_admin" ON public.feature_wishes;
CREATE POLICY "feature_wishes_update_admin" ON public.feature_wishes
    FOR UPDATE TO authenticated USING (public.is_admin_user());

DROP POLICY IF EXISTS "feature_wishes_delete_admin" ON public.feature_wishes;
CREATE POLICY "feature_wishes_delete_admin" ON public.feature_wishes
    FOR DELETE TO authenticated USING (public.is_admin_user());

-- === TRAVEL LOCATIONS ===
DROP POLICY IF EXISTS "travel_locations_select_own_or_tagged" ON public.travel_locations;
CREATE POLICY "travel_locations_select_own_or_tagged" ON public.travel_locations
    FOR SELECT TO authenticated USING (
        public.is_approved_user()
        AND (auth.uid() = user_id OR auth.uid() = with_relationship_id)
    );

DROP POLICY IF EXISTS "travel_locations_insert_own" ON public.travel_locations;
CREATE POLICY "travel_locations_insert_own" ON public.travel_locations
    FOR INSERT TO authenticated WITH CHECK (
        public.is_approved_user() AND auth.uid() = user_id
    );

DROP POLICY IF EXISTS "travel_locations_update_own" ON public.travel_locations;
CREATE POLICY "travel_locations_update_own" ON public.travel_locations
    FOR UPDATE TO authenticated USING (
        public.is_approved_user() AND auth.uid() = user_id
    );

DROP POLICY IF EXISTS "travel_locations_delete_own" ON public.travel_locations;
CREATE POLICY "travel_locations_delete_own" ON public.travel_locations
    FOR DELETE TO authenticated USING (
        public.is_approved_user() AND auth.uid() = user_id
    );

-- ============================================================
-- S7 - Restrict get_accessible_events() to the caller's own uid
-- ============================================================
-- Previously any authenticated user could call this SECURITY DEFINER
-- function with an arbitrary UUID and enumerate another user's event IDs.
-- Same logic as before, plus a guard that only allows uid = auth.uid().
-- Language changed from sql to plpgsql for the guard; signature and return
-- type are unchanged, so all existing RLS policies keep working.
-- Note: neither the frontend (src/) nor the backend (backend/src/) calls
-- this function directly - it is only used inside RLS policies with
-- auth.uid() as the argument, so the guard is fully compatible.
CREATE OR REPLACE FUNCTION public.get_accessible_events(uid UUID)
RETURNS SETOF UUID AS $$
BEGIN
    -- Note: with a NULL auth.uid() (server-side / service role context)
    -- this comparison is NULL and the guard passes; service role bypasses
    -- RLS anyway. Authenticated callers always have a non-NULL uid.
    IF uid <> auth.uid() THEN
        RAISE EXCEPTION 'access denied';
    END IF;

    RETURN QUERY
        SELECT id FROM public.events WHERE user_id = uid
        UNION
        SELECT event_id FROM public.event_attendees WHERE user_id = uid
        UNION
        SELECT event_id FROM public.event_viewers WHERE user_id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_accessible_events(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_accessible_events(UUID) TO authenticated;

-- ============================================================
-- S8 - RLS for push_subscriptions, event_comments, event_checklists
-- ============================================================
-- IMPORTANT: these tables are defined in backend/src/db/schema.ts (Drizzle)
-- and managed by the backend, not by the SQL files in this repo. Before
-- running this section, verify in the Supabase Dashboard that the tables
-- exist and that their columns match backend/src/db/schema.ts - the repo
-- SQL may drift from the live schema.
-- The backend connects with the service role and bypasses RLS, so its
-- access is unaffected by these policies.

-- Helper: is the current user a participant (owner, attendee or viewer)
-- of the given event? SECURITY DEFINER to avoid RLS recursion/nesting
-- when used inside policies.
CREATE OR REPLACE FUNCTION public.is_event_participant(p_event_id UUID)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = p_event_id AND e.user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.event_attendees ea
        WHERE ea.event_id = p_event_id AND ea.user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.event_viewers ev
        WHERE ev.event_id = p_event_id AND ev.user_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_event_participant(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_event_participant(UUID) TO authenticated;

-- === PUSH SUBSCRIPTIONS ===
-- Users manage only their own subscription rows.
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_select_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_update_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- === EVENT COMMENTS ===
-- Event participants (owner/attendee/viewer) can read and post comments;
-- authors can only edit/delete their own comments.
ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_comments_select_participants" ON public.event_comments;
CREATE POLICY "event_comments_select_participants" ON public.event_comments
    FOR SELECT TO authenticated USING (public.is_event_participant(event_id));

DROP POLICY IF EXISTS "event_comments_insert_participants" ON public.event_comments;
CREATE POLICY "event_comments_insert_participants" ON public.event_comments
    FOR INSERT TO authenticated WITH CHECK (
        public.is_event_participant(event_id) AND user_id = auth.uid()
    );

DROP POLICY IF EXISTS "event_comments_update_own" ON public.event_comments;
CREATE POLICY "event_comments_update_own" ON public.event_comments
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "event_comments_delete_own" ON public.event_comments;
CREATE POLICY "event_comments_delete_own" ON public.event_comments
    FOR DELETE TO authenticated USING (user_id = auth.uid());

-- === EVENT CHECKLISTS ===
-- Columns (backend/src/db/schema.ts): id, event_id, title, is_completed,
-- created_at. No user_id column: all event participants may manage items.
ALTER TABLE public.event_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_checklists_select_participants" ON public.event_checklists;
CREATE POLICY "event_checklists_select_participants" ON public.event_checklists
    FOR SELECT TO authenticated USING (public.is_event_participant(event_id));

DROP POLICY IF EXISTS "event_checklists_insert_participants" ON public.event_checklists;
CREATE POLICY "event_checklists_insert_participants" ON public.event_checklists
    FOR INSERT TO authenticated WITH CHECK (public.is_event_participant(event_id));

DROP POLICY IF EXISTS "event_checklists_update_participants" ON public.event_checklists;
CREATE POLICY "event_checklists_update_participants" ON public.event_checklists
    FOR UPDATE TO authenticated
    USING (public.is_event_participant(event_id))
    WITH CHECK (public.is_event_participant(event_id));

DROP POLICY IF EXISTS "event_checklists_delete_participants" ON public.event_checklists;
CREATE POLICY "event_checklists_delete_participants" ON public.event_checklists
    FOR DELETE TO authenticated USING (public.is_event_participant(event_id));

-- ============================================================
-- R15 - Race-free recurrence exception RPC
-- ============================================================
-- Replaces the frontend's read-modify-write in excludeOccurrence()
-- (src/lib/api.ts), which can lose exceptions when two exclusions race.
--
-- Note on the parameter type: events.recurrence_exceptions is TEXT[]
-- holding ISO timestamp strings (the frontend passes
-- new Date(start_time).toISOString()), so p_date is TEXT, not DATE.
--
-- SECURITY INVOKER is sufficient and deliberately chosen: the
-- events_update_own policy (auth.uid() = user_id) already permits the
-- update for the event owner, which matches the current effective
-- permissions of the direct frontend update. RLS is fully enforced.
--
-- Atomic and duplicate-safe: a single UPDATE with a NOT (array @> value)
-- guard. Returns the resulting recurrence_exceptions array (or the
-- unchanged array when the date was already excluded or the row is not
-- visible/writable for the caller).
CREATE OR REPLACE FUNCTION public.add_recurrence_exception(p_event_id UUID, p_date TEXT)
RETURNS TEXT[] AS $$
DECLARE
    result TEXT[];
BEGIN
    UPDATE public.events
    SET recurrence_exceptions = array_append(COALESCE(recurrence_exceptions, '{}'), p_date)
    WHERE id = p_event_id
      AND NOT (COALESCE(recurrence_exceptions, '{}') @> ARRAY[p_date])
    RETURNING recurrence_exceptions INTO result;

    IF NOT FOUND THEN
        -- No row updated: either the date is already excluded, or the event
        -- does not exist / is not writable by this user (RLS). Return the
        -- current state (NULL if not visible).
        SELECT e.recurrence_exceptions INTO result
        FROM public.events e
        WHERE e.id = p_event_id;
    END IF;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER VOLATILE SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.add_recurrence_exception(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_recurrence_exception(UUID, TEXT) TO authenticated;

COMMIT;

-- ============================================================
-- V - Verification queries (run manually after applying)
-- ============================================================
-- 1) Policies on the profiles table:
-- SELECT policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'profiles'
-- ORDER BY policyname;
--
-- 2) Trigger present on profiles:
-- SELECT tgname, tgenabled
-- FROM pg_trigger
-- WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal;
--
-- 3) RLS enabled on the three additional tables:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('push_subscriptions', 'event_comments', 'event_checklists');
--
-- 4) Policies on the three additional tables:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('push_subscriptions', 'event_comments', 'event_checklists')
-- ORDER BY tablename, policyname;
--
-- 5) Functions exist with the expected security mode (prosecdef = true
--    means SECURITY DEFINER):
-- SELECT proname, prosecdef
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND proname IN ('is_admin_user', 'is_approved_user', 'is_event_participant',
--                   'get_accessible_events', 'add_recurrence_exception',
--                   'protect_profile_admin_fields');
