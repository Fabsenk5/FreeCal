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

- `POST /auth/register`: Create account
- `POST /auth/login`: Login
- `GET /api/events`: List events (My events + Attending + Viewing)
- `POST /api/events`: Create event
