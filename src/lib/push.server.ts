import { buildPushPayload, vapidHeaders, type VapidKeys } from "@block65/webcrypto-web-push";
import { deliverPushNotifications, type PushMessageInput } from "@/lib/push";

export async function sendPushCampaign(message: PushMessageInput, vapid: VapidKeys) {
  // Check key configuration even when no devices are subscribed. Never log key material.
  try {
    await vapidHeaders({ endpoint: "https://fcm.googleapis.com/fcm/send/configuration-check", expirationTime: null, keys: { p256dh: "", auth: "" } }, vapid);
  } catch {
    throw new Error("Configure um par VAPID válido nos Secrets do Cloud");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return deliverPushNotifications({
    list: async afterId => {
      let query = supabaseAdmin.from("push_subscriptions")
        .select("id, endpoint, p256dh, auth").order("id").limit(100);
      if (afterId) query = query.gt("id", afterId);
      const { data, error } = await query;
      if (error) throw new Error("Não foi possível consultar os dispositivos inscritos");
      return data ?? [];
    },
    send: async device => {
      const payload = await buildPushPayload({
        data: { title: message.title, body: message.body, url: message.url },
        options: { ttl: 3600 },
      }, {
        endpoint: device.endpoint,
        expirationTime: null,
        keys: { p256dh: device.p256dh, auth: device.auth },
      }, vapid);
      const response = await fetch(device.endpoint, {
        ...payload,
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      await response.body?.cancel();
      return response.status;
    },
    remove: async id => {
      const { error } = await supabaseAdmin.from("push_subscriptions").delete().eq("id", id);
      if (error) throw new Error("Não foi possível remover a inscrição expirada");
    },
  });
}