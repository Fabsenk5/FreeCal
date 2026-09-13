# Mood Boards — Pinterest-style story boards

Status: **implemented** (schema, storage, data layer, UI). Applied to the production Supabase project.

Mood Boards are shared collections of images for shopping, interior and outfit ideas.
Unlike calendar events they carry no time information; they are a visual place to collect
and discuss ideas together (add pins, comment, vote up/down).

## 1. Decisions (planning)

| Topic | Decision |
| :--- | :--- |
| Entry point | 6th bottom-nav tab **Boards** (deep link `?tab=boards`; `/boards` redirects), detail at `/boards/:boardId` |
| Board detail | Own route `/boards/:boardId` |
| Sharing | Per board, with roles: **owner**, **editor**, **viewer** |
| Rights | Owner: full control + moderation. Editor: add pins, comment, vote, edit/delete **own** pins. Viewer: see, comment, vote (no uploads). |
| Invitees | Only **confirmed contacts** (accepted `relationships`) — enforced in RLS, not just in the UI |
| Comments | Per pin (Pinterest style), same audience as the board |
| Votes | One vote per user & pin: 👍 / 👎. Tapping the active thumb again removes the vote. |
| Pin fields | Image, note, optional product link, optional price |
| Categories | `shopping` \| `interior` \| `outfit` \| `other` (board-level, single value) |
| Images | Client-side compression to **WebP**: full max 1600 px, preview max 480 px |
| Storage | **Private** bucket `board-images`, served via **signed URLs** (2 h TTL) |
| Deletion | Uploader may always delete their own pin; board owner may delete any pin/comment and remove members; members may leave |
| Ordering | Boards and pins are ordered by activity (`updated_at` / `created_at` desc) |
| Overview | 2-column tile grid (mobile), first batch of 6 boards, then "load more" while scrolling; each tile shows up to 4 preview images as a mosaic |

Open for later (not part of the foundation): Supabase Realtime live updates, web-push
notifications for board activity, manual cover pin, drag & drop ordering, price sum per
board, full-text search across boards.

## 2. UX outline

### Overview `/boards`
- 2-column grid of board tiles (mobile); each tile: 2×2 preview mosaic (up to 4 images,
  MyCloset `photo-grid.tsx` style), title, category badge, member avatars, pin count,
  "last activity".
- Buttons: create board, edit/delete for own boards, leave for shared boards.
- Lazy loading: render 6 boards, load the next batch via IntersectionObserver
  ("load more" fallback button).

### Board detail `/boards/:id`
- Header: title, description, category, member avatars, share button (owner only).
- Pins in a 2-column grid; each pin shows preview image, note, price, vote counts
  (my vote highlighted), comment count.
- Click on a pin → detail view with full image (signed URL), note, link button,
  edit/delete (uploader/owner), vote buttons, comments (list + input).
- Add pin: file picker (multi-select), note/link/price form, upload progress.
- Share dialog (owner): pick confirmed contacts, choose editor/viewer, remove members.

## 3. Data model

Defined in `supabase/moodboards.sql`:

| Table | Columns |
| :--- | :--- |
| `mood_boards` | `id`, `owner_id` → profiles, `title`, `description`, `category`, `created_at`, `updated_at` |
| `mood_board_members` | `board_id`, `user_id`, `role` (`editor`/`viewer`), `created_at`, PK(`board_id`,`user_id`) |
| `mood_board_items` | `id`, `board_id`, `user_id` (uploader), `image_path`, `preview_path`, `note`, `link_url`, `price`, `created_at`, `updated_at` |
| `mood_board_comments` | `id`, `item_id`, `user_id`, `content`, `created_at` |
| `mood_board_votes` | `item_id`, `user_id`, `value` (±1), `created_at`, PK(`item_id`,`user_id`) |

The owner is not stored in `mood_board_members`. Content activity bumps
`mood_boards.updated_at` via trigger, so the overview can sort by "last activity".

## 4. Access control (RLS)

Helper functions (all `SECURITY DEFINER`, approval-gated in every policy):

- `is_mood_board_owner(board_id)` / `can_access_mood_board(board_id)` / `can_edit_mood_board(board_id)`
- `can_access_mood_board_item(item_id)` / `is_mood_board_owner_of_item(item_id)`
- `is_confirmed_contact(user_id)` — accepted relationship in either direction
- `mood_board_id_from_path(path)` — safe `<board_id>/...` extraction for storage policies

| Table | SELECT | INSERT | UPDATE | DELETE |
| :--- | :--- | :--- | :--- | :--- |
| `mood_boards` | owner or member | owner | owner | owner |
| `mood_board_members` | access | owner + confirmed contact | owner | owner or self (leave) |
| `mood_board_items` | access | owner/editor, `user_id = auth.uid()` | uploader or owner | uploader or owner |
| `mood_board_comments` | access | access, `user_id = auth.uid()` | author | author or owner |
| `mood_board_votes` | access | access, `user_id = auth.uid()` | own | own |
| `storage.objects` (`board-images`) | access | owner/editor, folder = own uid | – | uploader or owner |

Every policy additionally requires `public.is_approved_user()`; pending/rejected users
cannot see or touch board data even if they are members.

## 5. Storage & image pipeline

- Bucket `board-images`, **private**, 5 MB/object, MIME allowlist `image/webp`, `image/jpeg`, `image/png`.
- Layout: `<board_id>/<uploader_id>/<item_id>.webp` and `<item_id>-thumb.webp`.
- Client-side (`src/utils/imageCompression.ts`, `browser-image-compression`):
  downscale to max 1600 px / 480 px, convert to WebP (JPEG/PNG/HEIC input; HEIC needs a
  browser that can decode it, e.g. Safari).
- Rendering: `supabase.storage.createSignedUrls(paths, 7200)` — one batched call per view;
  no public URLs anywhere. URLs are re-signed on refetch.
- Deletion removes both objects from storage first, then the DB row (cascades).

## 6. Data layer (implemented)

`src/lib/api.ts` (section "MOOD BOARDS API"):

- Reads: `fetchMoodBoards`, `fetchMoodBoard`, `fetchMoodBoardComments`, `fetchMoodBoardContacts`, `getMoodBoardSignedUrl`
- Board writes: `createMoodBoard`, `updateMoodBoard`, `deleteMoodBoard`
- Sharing: `addMoodBoardMember`, `updateMoodBoardMemberRole`, `removeMoodBoardMember`
- Pins: `uploadMoodBoardItem`, `updateMoodBoardItem`, `deleteMoodBoardItem`
- Social: `setMoodBoardVote`, `addMoodBoardComment`, `deleteMoodBoardComment`

Hooks (`src/hooks/`):

- `useMoodBoards` → `{ boards, loading, refreshBoards }` (query key `['mood-boards', userId]`)
- `useMoodBoard` → `{ board, items, loading, refreshBoard }` (query key `['mood-board', boardId, userId]`)
- `useMoodBoardComments` → `{ comments, loading, refreshComments }` (query key `['mood-board-comments', itemId]`)
- `useMoodBoardContacts` → `{ contacts, loading }` for the share dialog (query key `['mood-board-contacts', userId]`)

The image preparation is tested in `src/utils/imageCompression.test.ts`, the mosaic in
`src/components/moodboards/BoardPreviewMosaic.test.tsx`.

## 7. UI (implemented)

- `src/pages/MoodBoards.tsx` — 2-column tile grid, first batch of 6 boards, loads more
  while scrolling ("Load more" fallback), create dialog, empty/loading states. Rendered
  as the 6th bottom-nav tab (`ActiveTab` in `src/pages/index.tsx`, `?tab=boards`);
  `/boards` redirects there for deep links.
- `src/pages/MoodBoardDetail.tsx` — board header (category, role badge, member avatars),
  pin grid, owner menu (edit/share/delete), "leave board" for members.
- `src/components/moodboards/`:
  - `BoardCard.tsx` + `BoardPreviewMosaic.tsx` — overview tile with 1–4 image mosaic
    (MyCloset photo-grid style, adapted to FreeCal colors/Tailwind 3)
  - `PinCard.tsx`, `PinDetailDialog.tsx` — full image, note/link/price, votes, comments,
    edit/delete own pins (owner may moderate any pin/comment)
  - `BoardFormDialog.tsx` (create/edit), `ShareBoardDialog.tsx` (contacts + roles),
    `AddPinDialog.tsx` (multi-upload with WebP compression)
  - supporting: `PinVoteButtons.tsx`, `SafeImage.tsx`, `InitialAvatar.tsx`, `labels.ts`
- Toasts via `sonner`, confirmations via `AlertDialog`, skeletons while loading.

Remaining ideas: Realtime updates, web-push for board activity, cover pin, drag ordering,
price sum per board.

## 8. Rollout (done)

1. `supabase/moodboards.sql` was applied to the production Supabase project via the
   pooler connection string (session mode). Re-running it is safe (idempotent).
2. Frontend deploys via Vercel auto-deploy on push; no backend/Render changes needed.
3. Rollback: drop the five tables and the bucket, or simply leave them in place — the
   policies only ever grant access to approved users.
