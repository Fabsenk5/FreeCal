
## 🔄 Database Switching Guide

This project supports both **Neon** (serverless, scale-to-zero) and **Supabase** (transaction pooler).

### Current Active: **Neon**

### How to Switch to Supabase

1.  **Update Environment Variables (`backend/.env`)**:
    - Comment out the Neon `DATABASE_URL`.
    - Uncomment the Supabase `DATABASE_URL`.

2.  **Update Connection Pool (`backend/src/db/connectionPool.ts`)**:
    - Comment out the `poolConfig` block for Neon.
    - Uncomment the `poolConfig` block for Supabase (Transaction Pooler).

3.  **Update Drizzle Config (`backend/drizzle.config.ts`)**:
    - Ensure SSL settings are compatible (usually fine as is, but check for `ssl: 'allow'`).

4.  **Verify**:
    - Restart backend: `npm run dev`.
    - Check connection logs.

### Migration Status
- **Schema**: Pushed to Supabase.
- **Data**: Partial/Pending (requires manual import from Neon dump).
