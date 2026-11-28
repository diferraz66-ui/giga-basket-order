self.addEventListener("push", (event) => {
  let payload = {};

  try {
    if (event.data) {
      try {
        payload = event.data.json();
      } catch {
        const text = event.data.text();
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { body: text };
        }
      }
    }
  } catch {
    payload = {};
  }

  if (!payload || typeof payload !== "object") payload = {};

  const title = typeof payload.title === "string" && payload.title.trim()
    ? payload.title.trim()
    : "GIGA SHOPPING";
  const body = typeof payload.body === "string" && payload.body.trim()
    ? payload.body
    : "Tem novidade na GIGA!";
  const rawUrl = typeof payload.url === "string" ? payload.url : "/";
  let url = "/";
  try {
    const target = new URL(rawUrl, self.location.origin);
    if (target.origin === self.location.origin) {
      url = target.pathname + target.search + target.hash;
    }
  } catch {
    url = "/";
  }

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url },
  }));
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
