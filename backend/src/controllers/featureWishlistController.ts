import { Request, Response } from 'express';
import { db } from '../db';
import { featureWishes } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

const ADMIN_EMAIL = 'fabiank5@hotmail.com';

export const featureWishlistController = {
    // Get all wishes
    getAllWishes: async (req: Request, res: Response) => {
        try {
            const wishes = await db.select()
                .from(featureWishes)
                .orderBy(desc(featureWishes.createdAt));

            res.json(wishes);
        } catch (error) {
            console.error('Error fetching wishes:', error);
            res.status(500).json({ message: 'Failed to fetch wishes' });
        }
    },

    // Create a new wish (Admin only)
    createWish: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            if (!user || user.email !== ADMIN_EMAIL) {
                return res.status(403).json({ message: 'Only admin can create wishes' });
            }

            const { title } = req.body;
            if (!title) {
                return res.status(400).json({ message: 'Title is required' });
            }

            const [newWish] = await db.insert(featureWishes).values({
                title,
                status: 'pending',
                createdBy: user.id
            }).returning();

            res.status(201).json(newWish);
        } catch (error) {
            console.error('Error creating wish:', error);
            res.status(500).json({ message: 'Failed to create wish' });
        }
    },

    // Update wish status (Admin only)
    updateWishStatus: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            if (!user || user.email !== ADMIN_EMAIL) {
                return res.status(403).json({ message: 'Only admin can update wishes' });
            }

            const { id } = req.params;
            const { status } = req.body;

            if (!['pending', 'completed'].includes(status)) {
                return res.status(400).json({ message: 'Invalid status' });
            }

            const [updatedWish] = await db.update(featureWishes)
                .set({ status })
                .where(eq(featureWishes.id, id))
                .returning();

            if (!updatedWish) {
                return res.status(404).json({ message: 'Wish not found' });
            }

            res.json(updatedWish);
        } catch (error) {
            console.error('Error updating wish:', error);
            res.status(500).json({ message: 'Failed to update wish' });
        }
    },

    // Delete wish (Admin only)
    deleteWish: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            if (!user || user.email !== ADMIN_EMAIL) {
                return res.status(403).json({ message: 'Only admin can delete wishes' });
            }

            const { id } = req.params;

            const [deletedWish] = await db.delete(featureWishes)
                .where(eq(featureWishes.id, id))
                .returning();

            if (!deletedWish) {
                return res.status(404).json({ message: 'Wish not found' });
            }

            res.json({ message: 'Wish deleted successfully' });
        } catch (error) {
            console.error('Error deleting wish:', error);
            res.status(500).json({ message: 'Failed to delete wish' });
        }
    }
};
