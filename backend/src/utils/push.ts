import webpush from 'web-push';
import { db } from '../db';
import { pushSubscriptions } from '../db/schema';
import { eq } from 'drizzle-orm';
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
        const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
        
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
                    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
                } else {
                    console.error('Failed to send push notification', err);
                }
            }
        }
    } catch (error) {
        console.error('Error querying push subscriptions', error);
    }
};
