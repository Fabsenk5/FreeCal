import { Request, Response } from 'express';
import { db } from '../db';
import { profiles } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Explicit response DTO: never leak password hashes or reset tokens to clients.
const mapProfileToFrontend = (p: typeof profiles.$inferSelect) => ({
    id: p.id,
    email: p.email,
    display_name: p.displayName,
    avatar_url: p.avatarUrl,
    calendar_color: p.calendarColor,
    is_approved: p.isApproved,
    approval_status: p.approvalStatus,
    created_at: p.createdAt?.toISOString(),
    updated_at: p.updatedAt?.toISOString(),
    approved_at: p.approvedAt?.toISOString(),
    approved_by: p.approvedBy,
});

// --- User Profile Operations ---

export const updateProfile = async (req: Request & { user?: any }, res: Response) => {
    if (!req.user) return res.sendStatus(401);
    const userId = req.user.id;
    const { display_name, calendar_color } = req.body;

    // TODO: Handle 'email' updates? Usually requires validation. Skipping for now.

    try {
        const [updated] = await db.update(profiles)
            .set({
                displayName: display_name,
                calendarColor: calendar_color,
                updatedAt: new Date()
            })
            .where(eq(profiles.id, userId))
            .returning();

        res.json(mapProfileToFrontend(updated));
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ message: 'Error updating profile' });
    }
};

export const searchUsers = async (req: Request & { user?: any }, res: Response) => {
    if (!req.user) return res.sendStatus(401);
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: 'Email query parameter required' });
    }

    try {
        // Exact match only (case-insensitive): a partial/ILIKE search would allow
        // enumerating user emails via wildcards like ?email=%25.
        const [user] = await db.select().from(profiles)
            .where(sql`lower(${profiles.email}) = ${email.trim().toLowerCase()}`);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(mapProfileToFrontend(user));
    } catch (error) {
        console.error('Search User Error:', error);
        res.status(500).json({ message: 'Error searching user' });
    }
};

// --- Admin Operations ---

// Admin rights come from the profiles.is_admin flag (exists in the Supabase
// schema, see supabase/migration.sql). The column is queried via raw SQL
// because it is not part of the Drizzle schema: the Neon database used by
// this backend does not have it yet. If the column is missing, we fall back
// to the legacy admin email below so the existing admin keeps access.
// To enable flag-based admin on Neon: ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
const ADMIN_EMAIL = 'fabiank5@hotmail.com';

const isAdmin = async (userId: string) => {
    try {
        const result = await db.execute<{ is_admin: boolean }>(
            sql`SELECT is_admin FROM profiles WHERE id = ${userId}`
        );
        const flag = result.rows[0]?.is_admin;
        if (flag === true) return true;
        if (flag === false) return false;
        // No row found -> not a user
        if (result.rows.length === 0) return false;
    } catch (error: any) {
        if (!String(error?.message || error).includes('is_admin')) throw error;
        // Column does not exist in this database -> fall through to email fallback
    }

    // Legacy fallback while the is_admin column is missing
    const [user] = await db.select({ email: profiles.email }).from(profiles).where(eq(profiles.id, userId));
    return !!user && user.email === ADMIN_EMAIL;
};

export const getAllUsers = async (req: Request & { user?: any }, res: Response) => {
    if (!req.user) return res.sendStatus(401);

    if (!(await isAdmin(req.user.id))) return res.sendStatus(403);

    try {
        const allProfiles = await db.select().from(profiles);
        res.json(allProfiles.map(mapProfileToFrontend));
    } catch (error) {
        console.error('Admin List Users Error:', error);
        res.status(500).json({ message: 'Error listing users' });
    }
};

export const adminUpdateUser = async (req: Request & { user?: any }, res: Response) => {
    if (!req.user) return res.sendStatus(401);
    if (!(await isAdmin(req.user.id))) return res.sendStatus(403);

    const { id } = req.params;
    const { approval_status, is_approved } = req.body;

    try {
        const [updated] = await db.update(profiles)
            .set({
                approvalStatus: approval_status,
                isApproved: is_approved,
                approvedAt: is_approved ? new Date() : null,
                approvedBy: is_approved ? req.user.id : null,
                updatedAt: new Date()
            })
            .where(eq(profiles.id, id))
            .returning();

        res.json(mapProfileToFrontend(updated));
    } catch (error) {
        console.error('Admin Update User Error:', error);
        res.status(500).json({ message: 'Error updating user' });
    }
};

export const adminDeleteUser = async (req: Request & { user?: any }, res: Response) => {
    if (!req.user) return res.sendStatus(401);
    if (!(await isAdmin(req.user.id))) return res.sendStatus(403);

    const { id } = req.params;

    try {
        await db.delete(profiles).where(eq(profiles.id, id));
        res.json({ message: 'User deleted' });
    } catch (error) {
        console.error('Admin Delete User Error:', error);
        res.status(500).json({ message: 'Error deleting user', error });
    }
}

export const adminUpdateUserPassword = async (req: Request & { user?: any }, res: Response) => {
    if (!req.user) return res.sendStatus(401);
    if (!(await isAdmin(req.user.id))) return res.sendStatus(403);

    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.update(profiles)
            .set({
                passwordHash: hashedPassword,
                updatedAt: new Date()
            })
            .where(eq(profiles.id, id));

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Admin Update Password Error:', error);
        res.status(500).json({ message: 'Error updating password', error });
    }
};
