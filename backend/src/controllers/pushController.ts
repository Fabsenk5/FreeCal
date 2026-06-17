import { Request, Response } from 'express';
import { supabaseAdmin } from '../db/supabaseAdmin';
import { sendPushNotificationToUser } from '../utils/push';

export const pushController = {
    subscribe: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            if (!user) return res.status(401).json({ message: 'Unauthorized' });

            const { endpoint, keys } = req.body;
            if (!endpoint || !keys) {
                return res.status(400).json({ message: 'Invalid subscription object' });
            }

            const { data: existingSub, error: fetchError } = await supabaseAdmin
                .from('push_subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .eq('endpoint', endpoint);

            if (fetchError) throw fetchError;

            if (!existingSub || existingSub.length === 0) {
                const { error: insertError } = await supabaseAdmin
                    .from('push_subscriptions')
                    .insert({
                        user_id: user.id,
                        endpoint,
                        p256dh: keys.p256dh,
                        auth: keys.auth,
                    });
                if (insertError) throw insertError;
            }

            res.status(201).json({ message: 'Subscribed' });
        } catch (error: any) {
            console.error('Push subscribe error:', error);
            res.status(500).json({ message: 'Failed to subscribe', error: error?.message, stack: error?.stack });
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
