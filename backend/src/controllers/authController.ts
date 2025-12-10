import { Request, Response } from 'express';
import { db } from '../db';
import { profiles } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6), // We need to store password hash, but schema doesn't have password field yet!
    displayName: z.string().min(1),
});

// IMPORTANT: The original schema used Supabase Auth, which stores passwords internally.
// We need to add a 'password_hash' column to our 'profiles' table to support custom auth,
// OR create a separate 'auth_users' table. 
// For simplicity in this migration plan, let's assume we modify the 'profiles' table or add a local auth table.
// Wait, 'profiles' extends auth.users. 
// I should probably update schema.ts to include password_hash if I want to keep it simple, 
// or follow best practices and have a separate auth table.
// Given strict instructions to migrate, I will add 'passwordHash' to profiles schema in schema.ts update next.

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

        // Note: We need to update schema.ts to support password field before this works properly.
        // For now, I'll write the logic assuming the field exists or is handled.
        // Actually, I'll handle the schema update in the next step.

        const [newUser] = await db.insert(profiles).values({
            email,
            displayName,
            passwordHash: hashedPassword,
        } as any).returning();

        const token = jwt.sign({ id: newUser.id, email: newUser.email }, process.env.JWT_SECRET!, { expiresIn: '1h' });

        res.json({ token, user: newUser });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user', error });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const user = await db.query.profiles.findFirst({
            where: eq(profiles.email, email),
        });

        if (!user || null) {
            return res.status(400).json({ message: 'User not found' });
        }

        // Check password
        if (!user.passwordHash) {
            return res.status(401).json({ message: 'User has no password set (migrated account?). Please reset password.' });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);

        if (!valid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET!, { expiresIn: '7d' });
        res.json({ token, user });
    } catch (error) {
        res.status(500).json({ message: 'Error logging in' });
    }
};

export const getMe = async (req: Request & { user?: any }, res: Response) => {
    if (!req.user) return res.sendStatus(401);

    const user = await db.query.profiles.findFirst({
        where: eq(profiles.id, req.user.id),
    });

    res.json(user);
};
