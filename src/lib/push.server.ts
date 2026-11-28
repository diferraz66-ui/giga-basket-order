import { buildPushPayload, vapidHeaders, type VapidKeys } from "@block65/webcrypto-web-push";
import { deliverPushNotifications, type PushMessageInput } from "@/lib/push";

export async function sendPushCampaign(message: PushMessageInput, vapid: VapidKeys) {
  // Check key configuration even when no devices are subscribed. Never log key material.
  try {
    if (!vapid.publicKey || !vapid.privateKey) throw new Error("Invalid configuration");
    const signed = await vapidHeaders({ endpoint: "https://fcm.googleapis.com/fcm/send/configuration-check", expirationTime: null, keys: { p256dh: "", auth: "" } }, vapid);
    const authorization = signed.headers.authorization;
    if (!authorization) throw new Error("Invalid configuration");
    const token = /^vapid t=([^,]+),/.exec(authorization)?.[1];
    const [header, claims, signature] = token?.split(".") ?? [];
    if (!header || !claims || !signature) throw new Error("Invalid configuration");
    const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), char => char.charCodeAt(0));
    const verificationKey = await crypto.subtle.importKey("raw", decode(vapid.publicKey), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const matches = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, verificationKey, decode(signature), new TextEncoder().encode(`${header}.${claims}`));
    if (!matches) throw new Error("Invalid configuration");
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