import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
};

export const usePushNotifications = () => {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;

        const subscribeToPush = async () => {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                return;
            }

            try {
                const registration = await navigator.serviceWorker.ready;
                const permission = await Notification.requestPermission();
                
                if (permission === 'granted') {
                    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
                    if (!vapidPublicKey) return;

                    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
                    
                    let subscription = await registration.pushManager.getSubscription();
                    if (!subscription) {
                        subscription = await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: convertedVapidKey
                        });
                    }

                    // Send subscription to backend
                    await api.post('/push/subscribe', subscription.toJSON());
                }
            } catch (error) {
                console.error('Error subscribing to push notifications:', error);
            }
        };

        subscribeToPush();
    }, [user]);
};

export const PushNotificationManager = () => {
    usePushNotifications();
    return null;
};
