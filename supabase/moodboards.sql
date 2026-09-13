-- ============================================================
-- FreeCal Mood Boards Migration
-- ============================================================
-- Idempotent: safe to run multiple times in the Supabase SQL Editor.
-- Creates the tables, helper functions, RLS policies and the private
-- storage bucket for the Mood/Story Boards feature (Pinterest-style
-- boards for shopping, interior and outfit ideas).
--
-- The frontend talks to Supabase directly (src/lib/api.ts + RLS), so
-- this file is the authoritative schema for the feature. The Express
-- backend (Neon) is not involved.
--
-- Prerequisites:
--   * public.profiles                      (supabase/migration.sql)
--   * public.update_updated_at_column()    (supabase/migration.sql)
--   * public.is_approved_user()            (supabase/security_hardening.sql)
--
-- Access model:
--   * owner  - full control: edit/delete the board, manage members,
--              moderate (delete) any pin or comment
--   * editor - member role: add pins, comment, vote; edit/delete own pins
--   * viewer - member role: see everything, comment, vote; no uploads
--   * Members can only be confirmed contacts (accepted relationship).
--   * All policies are gated on public.is_approved_user().
--
-- Storage layout (private bucket "board-images"):
--   <board_id>/<uploader_id>/<item_id>.webp
--   <board_id>/<uploader_id>/<item_id>-thumb.webp
--   The client compresses every upload to WebP (full max 1600px,
--   preview max 480px); images are served via short-lived signed URLs.
-- ============================================================

BEGIN;

-- ============================================================
-- M1 - TABLES
-- ============================================================

-- A board is owned by exactly one user; all other access is granted
-- through mood_board_members rows.
CREATE TABLE IF NOT EXISTS public.mood_boards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('shopping', 'interior', 'outfit', 'other')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shared access list. role='editor' may add pins, role='viewer' is
-- read/comment/vote only. The owner is NOT listed here.
CREATE TABLE IF NOT EXISTS public.mood_board_members (
    board_id UUID NOT NULL REFERENCES public.mood_boards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (board_id, user_id)
);

-- A pin: one image plus optional note, product link and price.
-- user_id is the uploader (not necessarily the board owner).
CREATE TABLE IF NOT EXISTS public.mood_board_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id UUID NOT NULL REFERENCES public.mood_boards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    image_path TEXT NOT NULL,
    preview_path TEXT NOT NULL,
    note TEXT,
    link_url TEXT,
    price NUMERIC(10, 2) CHECK (price IS NULL OR price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comments hang on individual pins (Pinterest style).
CREATE TABLE IF NOT EXISTS public.mood_board_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.mood_board_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (length(btrim(content)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One vote per user and pin; value is either +1 (thumbs up) or -1
-- (thumbs down). Tapping the active thumb again removes the row.
CREATE TABLE IF NOT EXISTS public.mood_board_votes (
    item_id UUID NOT NULL REFERENCES public.mood_board_items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    value SMALLINT NOT NULL CHECK (value IN (-1, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (item_id, user_id)
);

-- ============================================================
-- M2 - INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_mood_boards_owner ON public.mood_boards(owner_id);
CREATE INDEX IF NOT EXISTS idx_mood_boards_updated_at ON public.mood_boards(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mood_board_members_user ON public.mood_board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_board_items_board ON public.mood_board_items(board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mood_board_items_user ON public.mood_board_items(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_board_comments_item ON public.mood_board_comments(item_id, created_at);
CREATE INDEX IF NOT EXISTS idx_mood_board_votes_item ON public.mood_board_votes(item_id);

-- ============================================================
-- M3 - updated_at TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS update_mood_boards_updated_at ON public.mood_boards;
CREATE TRIGGER update_mood_boards_updated_at
    BEFORE UPDATE ON public.mood_boards
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_mood_board_items_updated_at ON public.mood_board_items;
CREATE TRIGGER update_mood_board_items_updated_at
    BEFORE UPDATE ON public.mood_board_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bubble content activity up to the board so the overview can sort by
-- "last activity". SECURITY DEFINER because editors/viewers may trigger
-- this while only the owner has an UPDATE policy on mood_boards.
CREATE OR REPLACE FUNCTION public.touch_mood_board_from_item()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.mood_boards SET updated_at = NOW()
    WHERE id = COALESCE(NEW.board_id, OLD.board_id);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.touch_mood_board_from_comment()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.mood_boards b SET updated_at = NOW()
    FROM public.mood_board_items i
    WHERE i.id = NEW.item_id AND b.id = i.board_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.touch_mood_board_from_item() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_mood_board_from_comment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS touch_mood_board_on_item ON public.mood_board_items;
CREATE TRIGGER touch_mood_board_on_item
    AFTER INSERT OR DELETE ON public.mood_board_items
    FOR EACH ROW EXECUTE FUNCTION public.touch_mood_board_from_item();

DROP TRIGGER IF EXISTS touch_mood_board_on_comment ON public.mood_board_comments;
CREATE TRIGGER touch_mood_board_on_comment
    AFTER INSERT ON public.mood_board_comments
    FOR EACH ROW EXECUTE FUNCTION public.touch_mood_board_from_comment();

-- ============================================================
-- M4 - HELPER FUNCTIONS
-- ============================================================
-- All helpers are SECURITY DEFINER so the membership checks inside RLS
-- policies cannot recurse into the same policies and do not depend on
-- the caller's row visibility.

-- Is the current user the owner of the board?
CREATE OR REPLACE FUNCTION public.is_mood_board_owner(p_board_id UUID)
RETURNS boolean AS $$
    SELECT p_board_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.mood_boards b
        WHERE b.id = p_board_id AND b.owner_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Is the current user the owner or any member (editor/viewer)?
CREATE OR REPLACE FUNCTION public.can_access_mood_board(p_board_id UUID)
RETURNS boolean AS $$
    SELECT p_board_id IS NOT NULL AND (
        EXISTS (
            SELECT 1 FROM public.mood_boards b
            WHERE b.id = p_board_id AND b.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.mood_board_members m
            WHERE m.board_id = p_board_id AND m.user_id = auth.uid()
        )
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- May the current user add pins? Owner or member with role 'editor'.
CREATE OR REPLACE FUNCTION public.can_edit_mood_board(p_board_id UUID)
RETURNS boolean AS $$
    SELECT p_board_id IS NOT NULL AND (
        EXISTS (
            SELECT 1 FROM public.mood_boards b
            WHERE b.id = p_board_id AND b.owner_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.mood_board_members m
            WHERE m.board_id = p_board_id AND m.user_id = auth.uid() AND m.role = 'editor'
        )
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Is the given user an accepted contact of the current user? Boards may
-- only be shared with confirmed contacts.
CREATE OR REPLACE FUNCTION public.is_confirmed_contact(p_user_id UUID)
RETURNS boolean AS $$
    SELECT p_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.relationships r
        WHERE r.status = 'accepted'
          AND (
              (r.user_id = auth.uid() AND r.related_user_id = p_user_id)
              OR (r.related_user_id = auth.uid() AND r.user_id = p_user_id)
          )
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Same as can_access_mood_board, but resolved through a pin.
CREATE OR REPLACE FUNCTION public.can_access_mood_board_item(p_item_id UUID)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.mood_board_items i
        WHERE i.id = p_item_id AND public.can_access_mood_board(i.board_id)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Same as is_mood_board_owner, but resolved through a pin.
CREATE OR REPLACE FUNCTION public.is_mood_board_owner_of_item(p_item_id UUID)
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.mood_board_items i
        WHERE i.id = p_item_id AND public.is_mood_board_owner(i.board_id)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Extracts the board id from a storage object path
-- '<board_id>/<uploader_id>/<file>'. Returns NULL instead of raising an
-- error for foreign paths, so storage policies simply deny them.
CREATE OR REPLACE FUNCTION public.mood_board_id_from_path(p_path TEXT)
RETURNS UUID AS $$
    SELECT CASE
        WHEN p_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
        THEN split_part(p_path, '/', 1)::uuid
        ELSE NULL
    END;
$$ LANGUAGE sql IMMUTABLE SET search_path = public;

-- Policy helpers are only for authenticated users; trigger functions are
-- not callable at all (revoked above).
REVOKE EXECUTE ON FUNCTION public.is_mood_board_owner(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_mood_board(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_mood_board(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_confirmed_contact(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_mood_board_item(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_mood_board_owner_of_item(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mood_board_id_from_path(TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_mood_board_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_mood_board(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_mood_board(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_confirmed_contact(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_mood_board_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_mood_board_owner_of_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mood_board_id_from_path(TEXT) TO authenticated;

-- ============================================================
-- M5 - ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.mood_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_board_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_board_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_board_votes ENABLE ROW LEVEL SECURITY;

-- === MOOD BOARDS ===
-- The direct predicate owner_id = auth.uid() is required next to the
-- helper call: the frontend inserts via .insert().select() and the
-- helper cannot see the just-inserted row within the same statement.
DROP POLICY IF EXISTS "mood_boards_select_access" ON public.mood_boards;
CREATE POLICY "mood_boards_select_access" ON public.mood_boards
    FOR SELECT TO authenticated USING (
        public.is_approved_user()
        AND (owner_id = auth.uid() OR public.can_access_mood_board(id))
    );

DROP POLICY IF EXISTS "mood_boards_insert_own" ON public.mood_boards;
CREATE POLICY "mood_boards_insert_own" ON public.mood_boards
    FOR INSERT TO authenticated WITH CHECK (
        public.is_approved_user() AND owner_id = auth.uid()
    );

-- Only the owner may change title/description/category of a board.
DROP POLICY IF EXISTS "mood_boards_update_own" ON public.mood_boards;
CREATE POLICY "mood_boards_update_own" ON public.mood_boards
    FOR UPDATE TO authenticated
    USING (public.is_approved_user() AND owner_id = auth.uid())
    WITH CHECK (public.is_approved_user() AND owner_id = auth.uid());

DROP POLICY IF EXISTS "mood_boards_delete_own" ON public.mood_boards;
CREATE POLICY "mood_boards_delete_own" ON public.mood_boards
    FOR DELETE TO authenticated USING (
        public.is_approved_user() AND owner_id = auth.uid()
    );

-- === MOOD BOARD MEMBERS ===
-- Everyone with access may see the member list.
DROP POLICY IF EXISTS "mood_board_members_select_access" ON public.mood_board_members;
CREATE POLICY "mood_board_members_select_access" ON public.mood_board_members
    FOR SELECT TO authenticated USING (
        public.is_approved_user() AND public.can_access_mood_board(board_id)
    );

-- Only the owner invites, and only confirmed contacts.
DROP POLICY IF EXISTS "mood_board_members_insert_owner" ON public.mood_board_members;
CREATE POLICY "mood_board_members_insert_owner" ON public.mood_board_members
    FOR INSERT TO authenticated WITH CHECK (
        public.is_approved_user()
        AND public.is_mood_board_owner(board_id)
        AND public.is_confirmed_contact(user_id)
    );

-- Only the owner changes roles.
DROP POLICY IF EXISTS "mood_board_members_update_owner" ON public.mood_board_members;
CREATE POLICY "mood_board_members_update_owner" ON public.mood_board_members
    FOR UPDATE TO authenticated
    USING (public.is_approved_user() AND public.is_mood_board_owner(board_id))
    WITH CHECK (public.is_approved_user() AND public.is_mood_board_owner(board_id));

-- Owner removes members; members may remove themselves (leave board).
DROP POLICY IF EXISTS "mood_board_members_delete_owner_or_self" ON public.mood_board_members;
CREATE POLICY "mood_board_members_delete_owner_or_self" ON public.mood_board_members
    FOR DELETE TO authenticated USING (
        public.is_approved_user()
        AND (public.is_mood_board_owner(board_id) OR user_id = auth.uid())
    );

-- === MOOD BOARD ITEMS (PINS) ===
DROP POLICY IF EXISTS "mood_board_items_select_access" ON public.mood_board_items;
CREATE POLICY "mood_board_items_select_access" ON public.mood_board_items
    FOR SELECT TO authenticated USING (
        public.is_approved_user() AND public.can_access_mood_board(board_id)
    );

-- Owner and editors add pins; user_id must be the uploader.
DROP POLICY IF EXISTS "mood_board_items_insert_editors" ON public.mood_board_items;
CREATE POLICY "mood_board_items_insert_editors" ON public.mood_board_items
    FOR INSERT TO authenticated WITH CHECK (
        public.is_approved_user()
        AND public.can_edit_mood_board(board_id)
        AND user_id = auth.uid()
    );

-- Uploaders edit their own pins; the owner may moderate any pin.
DROP POLICY IF EXISTS "mood_board_items_update_own_or_owner" ON public.mood_board_items;
CREATE POLICY "mood_board_items_update_own_or_owner" ON public.mood_board_items
    FOR UPDATE TO authenticated
    USING (
        public.is_approved_user()
        AND (user_id = auth.uid() OR public.is_mood_board_owner(board_id))
    )
    WITH CHECK (
        public.is_approved_user()
        AND (user_id = auth.uid() OR public.is_mood_board_owner(board_id))
    );

DROP POLICY IF EXISTS "mood_board_items_delete_own_or_owner" ON public.mood_board_items;
CREATE POLICY "mood_board_items_delete_own_or_owner" ON public.mood_board_items
    FOR DELETE TO authenticated USING (
        public.is_approved_user()
        AND (user_id = auth.uid() OR public.is_mood_board_owner(board_id))
    );

-- === MOOD BOARD COMMENTS ===
-- Any member (editor or viewer) may read, comment and vote.
DROP POLICY IF EXISTS "mood_board_comments_select_access" ON public.mood_board_comments;
CREATE POLICY "mood_board_comments_select_access" ON public.mood_board_comments
    FOR SELECT TO authenticated USING (
        public.is_approved_user() AND public.can_access_mood_board_item(item_id)
    );

DROP POLICY IF EXISTS "mood_board_comments_insert_members" ON public.mood_board_comments;
CREATE POLICY "mood_board_comments_insert_members" ON public.mood_board_comments
    FOR INSERT TO authenticated WITH CHECK (
        public.is_approved_user()
        AND public.can_access_mood_board_item(item_id)
        AND user_id = auth.uid()
    );

DROP POLICY IF EXISTS "mood_board_comments_update_own" ON public.mood_board_comments;
CREATE POLICY "mood_board_comments_update_own" ON public.mood_board_comments
    FOR UPDATE TO authenticated
    USING (public.is_approved_user() AND user_id = auth.uid())
    WITH CHECK (public.is_approved_user() AND user_id = auth.uid());

-- Authors delete their own comments; the board owner may moderate.
DROP POLICY IF EXISTS "mood_board_comments_delete_own_or_owner" ON public.mood_board_comments;
CREATE POLICY "mood_board_comments_delete_own_or_owner" ON public.mood_board_comments
    FOR DELETE TO authenticated USING (
        public.is_approved_user()
        AND (user_id = auth.uid() OR public.is_mood_board_owner_of_item(item_id))
    );

-- === MOOD BOARD VOTES ===
DROP POLICY IF EXISTS "mood_board_votes_select_access" ON public.mood_board_votes;
CREATE POLICY "mood_board_votes_select_access" ON public.mood_board_votes
    FOR SELECT TO authenticated USING (
        public.is_approved_user() AND public.can_access_mood_board_item(item_id)
    );

DROP POLICY IF EXISTS "mood_board_votes_insert_members" ON public.mood_board_votes;
CREATE POLICY "mood_board_votes_insert_members" ON public.mood_board_votes
    FOR INSERT TO authenticated WITH CHECK (
        public.is_approved_user()
        AND public.can_access_mood_board_item(item_id)
        AND user_id = auth.uid()
    );

DROP POLICY IF EXISTS "mood_board_votes_update_own" ON public.mood_board_votes;
CREATE POLICY "mood_board_votes_update_own" ON public.mood_board_votes
    FOR UPDATE TO authenticated
    USING (public.is_approved_user() AND user_id = auth.uid())
    WITH CHECK (
        public.is_approved_user()
        AND user_id = auth.uid()
        AND public.can_access_mood_board_item(item_id)
    );

DROP POLICY IF EXISTS "mood_board_votes_delete_own" ON public.mood_board_votes;
CREATE POLICY "mood_board_votes_delete_own" ON public.mood_board_votes
    FOR DELETE TO authenticated USING (
        public.is_approved_user() AND user_id = auth.uid()
    );

-- ============================================================
-- M6 - STORAGE: private bucket "board-images"
-- ============================================================
-- Private bucket: there is no public URL. The client resolves
-- short-lived signed URLs (see src/lib/api.ts).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'board-images',
    'board-images',
    FALSE,
    5242880, -- 5 MB per object (uploads are already compressed to WebP)
    ARRAY['image/webp', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Members may read objects of boards they can access (needed for
-- createSignedUrls()).
DROP POLICY IF EXISTS "board_images_select_members" ON storage.objects;
CREATE POLICY "board_images_select_members" ON storage.objects
    FOR SELECT TO authenticated USING (
        bucket_id = 'board-images'
        AND public.is_approved_user()
        AND public.can_access_mood_board(public.mood_board_id_from_path(name))
    );

-- Owner and editors may upload; the second path segment must be their
-- own user id (layout: <board_id>/<uploader_id>/<file>).
DROP POLICY IF EXISTS "board_images_insert_editors" ON storage.objects;
CREATE POLICY "board_images_insert_editors" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'board-images'
        AND public.is_approved_user()
        AND public.can_edit_mood_board(public.mood_board_id_from_path(name))
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

-- Uploaders delete their own files; the board owner may clean up any.
DROP POLICY IF EXISTS "board_images_delete_own_or_owner" ON storage.objects;
CREATE POLICY "board_images_delete_own_or_owner" ON storage.objects
    FOR DELETE TO authenticated USING (
        bucket_id = 'board-images'
        AND public.is_approved_user()
        AND (
            owner = auth.uid()
            OR public.is_mood_board_owner(public.mood_board_id_from_path(name))
        )
    );

COMMIT;

-- ============================================================
-- V - VERIFICATION (optional, run manually after COMMIT)
-- ============================================================
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE schemaname = 'public' AND tablename LIKE 'mood_board%'
-- ORDER BY tablename, policyname;
--
-- SELECT id, name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets WHERE id = 'board-images';
--
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND policyname LIKE 'board_images%';
