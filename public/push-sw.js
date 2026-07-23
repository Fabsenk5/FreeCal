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

    // Defense-in-depth: only open same-origin URLs (or relative paths that
    // resolve to this origin). Anything else falls back to the app root.
    var target = (event.notification.data && event.notification.data.url) || '/';
    var url;
    try {
        url = new URL(target, self.location.origin);
    } catch (e) {
        url = new URL('/', self.location.origin);
    }
    if (url.origin !== self.location.origin) {
        url = new URL('/', self.location.origin);
    }

    event.waitUntil(
        clients.openWindow(url.href)
    );
});
