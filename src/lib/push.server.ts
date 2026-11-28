import webpush from "web-push";
import { deliverPushNotifications, type PushMessageInput } from "@/lib/push";

type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export async function sendPushCampaign(message: PushMessageInput, vapid: VapidConfig) {
  if (!vapid.publicKey || !vapid.privateKey || !vapid.subject) {
    throw new Error("Configure as chaves VAPID nos Secrets do Cloud.");
  }

  webpush.setVapidDetails(
    "mailto:contato@gigashopping.app",
    vapid.publicKey,
    vapid.privateKey,
  );

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
      try {
        await webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          JSON.stringify({ title: message.title, body: message.body, url: message.url }),
          { TTL: 3600, urgency: "normal" },
        );
        return 201;
      } catch (error) {
        const pushError = error as { statusCode?: number; body?: string; message?: string };
        const status = Number(pushError.statusCode ?? 0);
        if (status > 0) {
          return {
            status,
            reason: String(pushError.body ?? pushError.message ?? "Push service rejected the request").slice(0, 500),
          };
        }
        throw new Error(String(pushError.message ?? "Falha de rede ao enviar Web Push").slice(0, 500));
      }
    },
    remove: async id => {
      const { error } = await supabaseAdmin.from("push_subscriptions").delete().eq("id", id);
      if (error) throw new Error("Não foi possível remover a inscrição expirada");
    },
  });
}
