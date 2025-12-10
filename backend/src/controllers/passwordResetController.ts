import { Request, Response } from 'express';
import { db } from '../db';
import { profiles } from '../db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Mock email sender for now - in production this would use Nodemailer/SendGrid
const sendResetEmail = async (email: string, token: string) => {
    const resetLink = `http://localhost:5173/reset-password?token=${token}`; // TODO: Use env var for frontend URL
    console.log(`[EMAIL MOCK] Password Reset requested for ${email}`);
    console.log(`[EMAIL MOCK] Reset Link: ${resetLink}`);
    // In a real app: await emailService.send(email, template, { link: resetLink });
};

export const forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }

    try {
        const [user] = await db.select().from(profiles).where(eq(profiles.email, email));

        if (!user) {
            // Do not reveal if user exists
            return res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
        }

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000); // 1 hour

        await db.update(profiles)
            .set({
                resetToken: token,
                resetTokenExpires: expires
            })
            .where(eq(profiles.id, user.id));

        await sendResetEmail(email, token);

        res.json({ message: 'If an account exists with this email, a reset link has been sent.' });
    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({ message: 'Error processing request' });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required' });
    }

    try {
        // Find user with valid token
        const users = await db.select().from(profiles); // Inefficient scan, but Drizzle doesn't have easy 'where' for dynamic fields without iterating or raw sql if we don't index locally. 
        // Better: use .where() properly.

        // Wait, I can use .where() with and()
        // But first I need to find *by token*.
        // Since token is unique enough for this purpose (random hex).

        const [user] = await db.select().from(profiles).where(eq(profiles.resetToken, token));

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        if (!user.resetTokenExpires || new Date() > user.resetTokenExpires) {
            return res.status(400).json({ message: 'Token has expired' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await db.update(profiles)
            .set({
                passwordHash: hashedPassword,
                resetToken: null,
                resetTokenExpires: null
            })
            .where(eq(profiles.id, user.id));

        res.json({ message: 'Password has been reset successfully' });
    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ message: 'Error resetting password' });
    }
};
