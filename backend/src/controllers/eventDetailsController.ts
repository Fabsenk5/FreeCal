import { Request, Response } from 'express';
import { db } from '../db';
import { eventComments, eventChecklists, events, eventAttendees, eventViewers, profiles } from '../db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { sendPushNotificationToUser } from '../utils/push';

export const eventDetailsController = {
    // Comments
    getComments: async (req: Request, res: Response) => {
        const { eventId } = req.params;
        try {
            const comments = await db.select({
                id: eventComments.id,
                eventId: eventComments.eventId,
                userId: eventComments.userId,
                content: eventComments.content,
                createdAt: eventComments.createdAt,
                user: {
                    displayName: profiles.displayName,
                    avatarUrl: profiles.avatarUrl,
                }
            })
            .from(eventComments)
            .leftJoin(profiles, eq(eventComments.userId, profiles.id))
            .where(eq(eventComments.eventId, eventId))
            .orderBy(desc(eventComments.createdAt));

            res.json(comments);
        } catch (error) {
            res.status(500).json({ message: 'Failed to fetch comments' });
        }
    },

    addComment: async (req: Request, res: Response) => {
        const { eventId } = req.params;
        const { content } = req.body;
        const user = (req as any).user;
        
        try {
            const [newComment] = await db.insert(eventComments).values({
                eventId,
                userId: user.id,
                content
            }).returning();

            // Notify others
            const [event] = await db.select().from(events).where(eq(events.id, eventId));
            if (event) {
                const attendees = await db.select().from(eventAttendees).where(eq(eventAttendees.eventId, eventId));
                const viewers = await db.select().from(eventViewers).where(eq(eventViewers.eventId, eventId));
                const allParticipants = [...new Set([...attendees.map(a => a.userId), ...viewers.map(v => v.userId), event.userId])];
                
                const payload = { title: `New comment on ${event.title}`, body: `${user.display_name}: ${content}` };
                for (const uId of allParticipants) {
                    if (uId !== user.id) {
                        sendPushNotificationToUser(uId, payload).catch(console.error);
                    }
                }
            }

            res.status(201).json(newComment);
        } catch (error) {
            res.status(500).json({ message: 'Failed to add comment' });
        }
    },

    // Checklists
    getChecklist: async (req: Request, res: Response) => {
        const { eventId } = req.params;
        try {
            const items = await db.select().from(eventChecklists).where(eq(eventChecklists.eventId, eventId));
            res.json(items);
        } catch (error) {
            res.status(500).json({ message: 'Failed to fetch checklist' });
        }
    },

    addChecklistItem: async (req: Request, res: Response) => {
        const { eventId } = req.params;
        const { title } = req.body;
        
        try {
            const [newItem] = await db.insert(eventChecklists).values({
                eventId,
                title
            }).returning();
            res.status(201).json(newItem);
        } catch (error) {
            res.status(500).json({ message: 'Failed to add checklist item' });
        }
    },

    updateChecklistItem: async (req: Request, res: Response) => {
        const { id } = req.params;
        const { isCompleted, title } = req.body;
        
        try {
            const updateData: any = {};
            if (isCompleted !== undefined) updateData.isCompleted = isCompleted;
            if (title !== undefined) updateData.title = title;

            const [updatedItem] = await db.update(eventChecklists)
                .set(updateData)
                .where(eq(eventChecklists.id, id))
                .returning();
            res.json(updatedItem);
        } catch (error) {
            res.status(500).json({ message: 'Failed to update checklist item' });
        }
    },

    deleteChecklistItem: async (req: Request, res: Response) => {
        const { id } = req.params;
        try {
            await db.delete(eventChecklists).where(eq(eventChecklists.id, id));
            res.json({ message: 'Item deleted' });
        } catch (error) {
            res.status(500).json({ message: 'Failed to delete checklist item' });
        }
    },

    // Editor Toggle
    toggleEditor: async (req: Request, res: Response) => {
        const { eventId, userId } = req.params;
        const { isEditor } = req.body;
        const currentUser = (req as any).user;

        try {
            // Only event owner can toggle editors
            const [event] = await db.select().from(events).where(eq(events.id, eventId));
            if (!event || event.userId !== currentUser.id) {
                return res.status(403).json({ message: 'Not authorized to change roles' });
            }

            // Try updating attendee
            let updated: any[] = await db.update(eventAttendees)
                .set({ isEditor })
                .where(sql`${eventAttendees.eventId} = ${eventId} AND ${eventAttendees.userId} = ${userId}`)
                .returning();

            // Try updating viewer if not attendee
            if (updated.length === 0) {
                updated = await db.update(eventViewers)
                    .set({ isEditor })
                    .where(sql`${eventViewers.eventId} = ${eventId} AND ${eventViewers.userId} = ${userId}`)
                    .returning();
            }

            if (updated.length === 0) {
                return res.status(404).json({ message: 'User is not a participant' });
            }

            res.json({ message: 'Role updated successfully', isEditor });
        } catch (error) {
            res.status(500).json({ message: 'Failed to update role' });
        }
    }
};
