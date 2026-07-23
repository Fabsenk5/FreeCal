import { Request, Response } from 'express';
import { supabaseAdmin } from '../db/supabaseAdmin';
import { sendPushNotificationToUser } from '../utils/push';

const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 1000;

// All event IDs where the user is owner, attendee, or viewer
const getEventIdsForUser = async (userId: string): Promise<string[]> => {
    const [{ data: owned }, { data: attending }, { data: viewing }] = await Promise.all([
        supabaseAdmin.from('events').select('id').eq('user_id', userId),
        supabaseAdmin.from('event_attendees').select('event_id').eq('user_id', userId),
        supabaseAdmin.from('event_viewers').select('event_id').eq('user_id', userId),
    ]);
    const ids = [
        ...(owned || []).map((e: any) => e.id),
        ...(attending || []).map((e: any) => e.event_id),
        ...(viewing || []).map((e: any) => e.event_id),
    ];
    return [...new Set(ids)];
};

/**
 * The sender may only push-notify users they have an accepted relationship
 * with or share at least one event with (as owner/attendee/viewer).
 */
const canNotifyUser = async (senderId: string, targetId: string): Promise<boolean> => {
    try {
        const { data: rel } = await supabaseAdmin
            .from('relationships')
            .select('id')
            .eq('status', 'accepted')
            .or(`and(user_id.eq.${senderId},related_user_id.eq.${targetId}),and(user_id.eq.${targetId},related_user_id.eq.${senderId})`)
            .maybeSingle();

        if (rel) return true;

        const senderEventIds = await getEventIdsForUser(senderId);
        if (senderEventIds.length === 0) return false;

        const [{ data: owned }, { data: att }, { data: view }] = await Promise.all([
            supabaseAdmin.from('events').select('id').in('id', senderEventIds).eq('user_id', targetId).limit(1),
            supabaseAdmin.from('event_attendees').select('id').in('event_id', senderEventIds).eq('user_id', targetId).limit(1),
            supabaseAdmin.from('event_viewers').select('id').in('event_id', senderEventIds).eq('user_id', targetId).limit(1),
        ]);

        return (owned?.length || 0) + (att?.length || 0) + (view?.length || 0) > 0;
    } catch (error) {
        console.error('Error checking push authorization:', error);
        return false;
    }
};

// Only relative app paths are allowed as notification click targets
const isValidRelativeUrl = (url: string): boolean =>
    url.startsWith('/') && !url.startsWith('//');

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
    },

    sendNotification: async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            if (!user) return res.status(401).json({ message: 'Unauthorized' });

            const { userIds, title, body, url } = req.body;
            if (!userIds || !Array.isArray(userIds) || typeof title !== 'string' || !title) {
                return res.status(400).json({ message: 'Invalid payload' });
            }

            if (title.length > MAX_TITLE_LENGTH) {
                return res.status(400).json({ message: `Title must be at most ${MAX_TITLE_LENGTH} characters` });
            }
            if (body !== undefined && (typeof body !== 'string' || body.length > MAX_BODY_LENGTH)) {
                return res.status(400).json({ message: `Body must be a string of at most ${MAX_BODY_LENGTH} characters` });
            }
            if (url !== undefined && (typeof url !== 'string' || !isValidRelativeUrl(url))) {
                return res.status(400).json({ message: 'Only relative URLs (starting with /) are allowed' });
            }

            // The sender must be related to (accepted) or share an event with EVERY target
            const targetIds = userIds.filter((id: string) => id !== user.id);
            for (const targetId of targetIds) {
                if (typeof targetId !== 'string' || !(await canNotifyUser(user.id, targetId))) {
                    return res.status(403).json({ message: 'Not authorized to notify one or more recipients' });
                }
            }

            const payload = { title, body, url: url || '/' };

            for (const targetId of targetIds) {
                sendPushNotificationToUser(targetId, payload).catch(console.error);
            }

            res.json({ message: 'Notifications sent' });
        } catch (error) {
            console.error('Send push error:', error);
            res.status(500).json({ message: 'Failed to send push notifications' });
        }
    }
};
