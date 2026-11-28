self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() ?? "" };
  }

  const title = typeof payload.title === "string" && payload.title.trim()
    ? payload.title.trim()
    : "GIGA SHOPPING";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "Tem novidade na GIGA!",
    icon: typeof payload.icon === "string" ? payload.icon : "/favicon.png",
    badge: typeof payload.badge === "string" ? payload.badge : "/favicon.png",
    data: { url: typeof payload.url === "string" ? payload.url : "/" },
    tag: typeof payload.tag === "string" ? payload.tag : "giga-shopping",
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || "/";
  let target;
  try {
    target = new URL(rawUrl, self.location.origin);
    if (target.origin !== self.location.origin) target = new URL("/", self.location.origin);
  } catch {
    target = new URL("/", self.location.origin);
  }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "navigate" in client) {
        await client.navigate(target.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(target.href);
  })());
});
