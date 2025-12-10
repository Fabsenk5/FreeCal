# Data Migration Guide

Since direct database access is restricted, we recommend exporting data from the Supabase/Altan Cloud dashboard and importing it into the new system.

## Step 1: Export Data

1. Log in to your Altan Cloud / Supabase Dashboard.
2. Go to the **Table Editor**.
3. For each table (`profiles`, `events`, `relationships`, `event_attendees`, `event_viewers`):
   - Click "Export" (top right).
   - Select **Export as JSON**.
   - Save the files as:
     - `profiles.json`
     - `events.json`
     - `relationships.json`
     - `event_attendees.json`
     - `event_viewers.json`
4. Place these files in `backend/migration-data/`.

## Step 2: Run Migration

1. Ensure your `.env` in `backend/` has the correct `DATABASE_URL` for Neon.
2. Run the migration script:
   ```bash
   cd backend
   npm run migrate:data
   ```

## Step 3: Verify

Check the application or database to ensure all users and events are present.
