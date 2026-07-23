import { Request, Response } from 'express';
import { db } from '../db';
import { profiles } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6), // We need to store password hash, but schema doesn't have password field yet!
    displayName: z.string().min(1),
});

// Explicit response DTO: never leak password hashes or reset tokens to clients.
const mapUserToFrontend = (user: typeof profiles.$inferSelect) => ({
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    avatar_url: user.avatarUrl,
    calendar_color: user.calendarColor,
    is_approved: user.isApproved,
    approval_status: user.approvalStatus,
    approved_at: user.approvedAt,
    approved_by: user.approvedBy,
});

export const register = async (req: Request, res: Response) => {
    try {
        const { email, password, displayName } = registerSchema.parse(req.body);

        const existingUser = await db.query.profiles.findFirst({
            where: eq(profiles.email, email),
        });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [newUser] = await db.insert(profiles).values({
            email,
            displayName,
            passwordHash: hashedPassword,
        } as any).returning();

        const token = jwt.sign({ id: newUser.id, email: newUser.email }, process.env.JWT_SECRET!, { expiresIn: '1h' });

        res.json({ token, user: mapUserToFrontend(newUser) });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ message: 'Invalid input', issues: error.issues.map(i => i.message) });
        }
        console.error('Register Error:', error);
        res.status(500).json({ message: 'Error registering user' });
    }
};

// NOTE: no /login endpoint here. The frontend authenticates via Supabase Auth
// and the auth middleware verifies Supabase access tokens, so a custom-JWT
// login would be dead code (its tokens are accepted nowhere).

export const getMe = async (req: Request & { user?: any }, res: Response) => {
    if (!req.user) return res.sendStatus(401);

    const user = await db.query.profiles.findFirst({
        where: eq(profiles.id, req.user.id),
    });

    if (!user) return res.sendStatus(404);

    res.json(mapUserToFrontend(user));
};
