import webpush from 'web-push';
import { supabaseAdmin } from '../db/supabaseAdmin';
import * as dotenv from 'dotenv';
dotenv.config();

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

if (publicKey && privateKey) {
    webpush.setVapidDetails(
        'mailto:fabiank5@hotmail.com',
        publicKey,
        privateKey
    );
} else {
    console.warn('VAPID keys are missing from environment variables. Push notifications will not work.');
}

export const sendPushNotificationToUser = async (userId: string, payload: any) => {
    try {
        const { data: subs, error } = await supabaseAdmin
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', userId);
            
        if (error) throw error;
        if (!subs) return;
        
        for (const sub of subs) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    auth: sub.auth,
                    p256dh: sub.p256dh
                }
            };
            try {
                await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
            } catch (err: any) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Subscription expired or invalid, remove it
                    await supabaseAdmin
                        .from('push_subscriptions')
                        .delete()
                        .eq('id', sub.id);
                } else {
                    console.error('Failed to send push notification', err);
                }
            }
        }
    } catch (error) {
        console.error('Error querying push subscriptions', error);
    }
};
