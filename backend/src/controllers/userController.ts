import { Request, Response } from 'express';
import { db } from '../db';
import { profiles } from '../db/schema';
import { eq, like, ilike, ne } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

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

        res.json({
            ...updated,
            display_name: updated.displayName,
            calendar_color: updated.calendarColor,
            is_approved: updated.isApproved,
            approval_status: updated.approvalStatus
        });
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ message: 'Error updating profile', error });
    }
};

export const searchUsers = async (req: Request & { user?: any }, res: Response) => {
    if (!req.user) return res.sendStatus(401);
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: 'Email query parameter required' });
    }

    try {
        const [user] = await db.select().from(profiles).where(ilike(profiles.email, email));

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            ...user,
            display_name: user.displayName,
            calendar_color: user.calendarColor,
            is_approved: user.isApproved,
            approval_status: user.approvalStatus
        });
    } catch (error) {
        console.error('Search User Error:', error);
        res.status(500).json({ message: 'Error searching user', error });
    }
};

// --- Admin Operations ---

// Hardcoded admin email check for now
const ADMIN_EMAIL = 'fabiank5@hotmail.com';

const isAdmin = async (userId: string) => {
    const [user] = await db.select().from(profiles).where(eq(profiles.id, userId));
    return user && user.email === ADMIN_EMAIL;
};

export const getAllUsers = async (req: Request & { user?: any }, res: Response) => {
    console.log('API: getAllUsers calling...');
    if (!req.user) return res.sendStatus(401);

    // Debug: check logic
    const adminCheck = await isAdmin(req.user.id);
    console.log('API: getAllUsers isAdmin?', adminCheck, req.user.id);

    if (!adminCheck) return res.sendStatus(403);

    try {
        console.log('API: getAllUsers fetching profiles from DB...');
        const allProfiles = await db.select().from(profiles);
        console.log(`API: getAllUsers found ${allProfiles.length} profiles`);
        const mapped = allProfiles.map(p => ({
            ...p,
            display_name: p.displayName,
            calendar_color: p.calendarColor,
            is_approved: p.isApproved,
            approval_status: p.approvalStatus,
            created_at: p.createdAt?.toISOString(),
            approved_at: p.approvedAt?.toISOString()
        }));
        res.json(mapped);
    } catch (error) {
        console.error('Admin List Users Error:', error);
        res.status(500).json({ message: 'Error listing users', error });
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

        res.json({
            ...updated,
            display_name: updated.displayName,
            calendar_color: updated.calendarColor,
            is_approved: updated.isApproved,
            approval_status: updated.approvalStatus,
            created_at: updated.createdAt?.toISOString(),
            updated_at: updated.updatedAt?.toISOString(),
            approved_at: updated.approvedAt?.toISOString()
        });
    } catch (error) {
        console.error('Admin Update User Error:', error);
        res.status(500).json({ message: 'Error updating user', error });
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
