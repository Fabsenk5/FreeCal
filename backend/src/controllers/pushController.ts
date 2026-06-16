import { Request, Response } from 'express';
import { db } from '../db';
import { pushSubscriptions } from '../db/schema';
import { sendPushNotificationToUser } from '../utils/push';
import { eq, and } from 'drizzle-orm';

export const pushController = {
    subscribe: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            if (!user) return res.status(401).json({ message: 'Unauthorized' });

            const { endpoint, keys } = req.body;
            if (!endpoint || !keys) {
                return res.status(400).json({ message: 'Invalid subscription object' });
            }

            const existingSub = await db.select().from(pushSubscriptions).where(
                and(
                    eq(pushSubscriptions.userId, user.id),
                    eq(pushSubscriptions.endpoint, endpoint)
                )
            );

            if (existingSub.length === 0) {
                await db.insert(pushSubscriptions).values({
                    userId: user.id,
                    endpoint,
                    p256dh: keys.p256dh,
                    auth: keys.auth,
                });
            }

            res.status(201).json({ message: 'Subscribed' });
        } catch (error) {
            console.error('Push subscribe error:', error);
            res.status(500).json({ message: 'Failed to subscribe' });
        }
    },

    testNotification: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            if (!user) return res.status(401).json({ message: 'Unauthorized' });

            await sendPushNotificationToUser(user.id, {
                title: 'Test Notification',
                body: 'Push notifications are working!',
            });

            res.json({ message: 'Test notification sent' });
        } catch (error) {
            console.error('Test push error:', error);
            res.status(500).json({ message: 'Failed to send test push' });
        }
    }
};
