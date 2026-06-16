self.addEventListener('push', function(event) {
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { body: event.data.text() };
        }
    }
    
    const title = data.title || 'FreeCal Notification';
    const options = {
        body: data.body || 'You have a new notification.',
        icon: '/favicon/android/android-launchericon-192-192.png',
        badge: '/favicon/android/android-launchericon-192-192.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        }
    };
    
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
