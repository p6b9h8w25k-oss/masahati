self.addEventListener('push', (event) => {
  let data = { title: 'مساحتي', body: '' };
  try { data = event.data.json(); } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, { body: data.body, lang: 'ar', tag: 'masahati-reminder' })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('./'));
});