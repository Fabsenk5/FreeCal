# FreeCal Backend

Node.js + Express + Drizzle ORM + Neon (Postgres) backend.

## Setup

1. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL`: Your Neon Postgres connection string
   - `JWT_SECRET`: A secret string for auth tokens

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run migrations (to create tables):
   ```bash
   npx drizzle-kit push
   ```

4. Start server:
   ```bash
   npm run dev
   ```

## API

- `POST /auth/register`: Create account (rate-limited)
- `POST /auth/forgot-password` / `POST /auth/reset-password`: Password reset (rate-limited)
- `GET /auth/me`: Current profile (Bearer Supabase access token)
- `POST /api/push/subscribe|test|notify`: Web push (rate-limited)
- `GET|POST /api/events/:eventId/comments`, `GET|POST /api/events/:eventId/checklist`,
  `PUT|DELETE /api/checklists/:id`, `PUT /api/events/:eventId/editors/:userId`: Event details
- `GET /api/users/search`, `PUT /api/users/profile`, `GET|PUT|DELETE /api/admin/users*`: Users/Admin

Note: there is no `/auth/login` endpoint — the frontend logs in via Supabase Auth
directly, and `src/middleware/auth.ts` verifies Supabase access tokens. Events,
relationships, travel locations and feature wishes are handled by the frontend
against Supabase (RLS); the old Express controllers for them were removed.
