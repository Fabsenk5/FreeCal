import { Request, Response } from 'express';
import { db } from '../db';
import { relationships, profiles } from '../db/schema';
import { eq, or, and, inArray } from 'drizzle-orm';

export const getRelationships = async (req: Request & { user?: any }, res: Response) => {
    if (!req.user) return res.sendStatus(401);
    const userId = req.user.id;
    const { status } = req.query; // 'accepted' | 'pending' | undefined

    try {
        let whereClause = or(
            eq(relationships.userId, userId),
            eq(relationships.relatedUserId, userId)
        );

        if (status && typeof status === 'string') {
            whereClause = and(
                whereClause,
                eq(relationships.status, status as any)
            );
        }

        const rels = await db.select().from(relationships).where(whereClause);

        // Fetch profiles for the "other" user in the relationship
        // Simplify: just fetch all relevant profiles in one go
        const otherUserIds = rels.map(r => r.userId === userId ? r.relatedUserId : r.userId);
        const uniqueOtherIds = [...new Set(otherUserIds)];

        if (uniqueOtherIds.length === 0) {
            return res.json([]);
        }

        const relatedProfiles = await db.select().from(profiles).where(inArray(profiles.id, uniqueOtherIds));
        const profileMap = new Map(relatedProfiles.map(p => [p.id, p]));

        const results = rels.map(rel => {
            const otherId = rel.userId === userId ? rel.relatedUserId : rel.userId;
            const profile = profileMap.get(otherId);
            return {
                ...rel,
                user_id: rel.userId,
                related_user_id: rel.relatedUserId,
                created_at: rel.createdAt?.toISOString(),
                updated_at: rel.updatedAt?.toISOString(),
                profile: profile ? {
                    ...profile,
                    display_name: profile.displayName,
                    avatar_url: profile.avatarUrl,
                    calendar_color: profile.calendarColor,
                    is_approved: profile.isApproved,
                    approval_status: profile.approvalStatus
                } : null
            };
        });

        res.json(results);
    } catch (error) {
        console.error('Get Relationships Error:', error);
        res.status(500).json({ message: 'Error fetching relationships', error });
    }
};

export const createRelationship = async (req: Request & { user?: any }, res: Response) => {
    if (!req.user) return res.sendStatus(401);
    const userId = req.user.id;
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: 'Email is required' });

    try {
        // 1. Find user by email
        const [targetUser] = await db.select().from(profiles).where(eq(profiles.email, email));

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (targetUser.id === userId) {
            return res.status(400).json({ message: 'Cannot add yourself' });
        }

        // 2. Check if relationship already exists
        const [existing] = await db.select().from(relationships).where(
            or(
                and(eq(relationships.userId, userId), eq(relationships.relatedUserId, targetUser.id)),
                and(eq(relationships.userId, targetUser.id), eq(relationships.relatedUserId, userId))
            )
        );

        if (existing) {
            return res.status(400).json({ message: 'Relationship already exists' });
        }

        // 3. Create relationship
        const [newRel] = await db.insert(relationships).values({
            userId,
            relatedUserId: targetUser.id,
            status: 'pending'
        }).returning();

        res.json({
            ...newRel,
            user_id: newRel.userId,
            related_user_id: newRel.relatedUserId,
            created_at: newRel.createdAt?.toISOString(),
            updated_at: newRel.updatedAt?.toISOString(),
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating relationship', error });
    }
};

export const updateRelationship = async (req: Request & { user?: any }, res: Response) => {
    if (!req.user) return res.sendStatus(401);
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body; // 'accepted' | 'rejected'

    try {
        const [existing] = await db.select().from(relationships).where(eq(relationships.id, id));
        if (!existing) return res.status(404).json({ message: 'Relationship not found' });

        // Only the recipient can accept/reject (usually)
        // But for update in general, check permissions.
        // If accepting/rejecting, must be relatedUserId.
        // If cancelling... that's delete.

        if (existing.relatedUserId !== userId) {
            return res.status(403).json({ message: 'Not authorized to update this relationship' });
        }

        const [updated] = await db.update(relationships)
            .set({ status, updatedAt: new Date() })
            .where(eq(relationships.id, id))
            .returning();

        res.json({
            ...updated,
            user_id: updated.userId,
            related_user_id: updated.relatedUserId,
            created_at: updated.createdAt?.toISOString(),
            updated_at: updated.updatedAt?.toISOString(),
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating relationship', error });
    }
}

export const deleteRelationship = async (req: Request & { user?: any }, res: Response) => {
    if (!req.user) return res.sendStatus(401);
    const userId = req.user.id;
    const { id } = req.params;

    try {
        const [existing] = await db.select().from(relationships).where(eq(relationships.id, id));
        if (!existing) return res.status(404).json({ message: 'Relationship not found' });

        // Either party can delete (cancel or unfriend)
        if (existing.userId !== userId && existing.relatedUserId !== userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await db.delete(relationships).where(eq(relationships.id, id));
        res.json({ message: 'Relationship deleted' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting relationship', error });
    }
}
