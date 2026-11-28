import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertPushAdmin, pushMessageSchema } from "@/lib/push";

// This is deliberately publishable key material, not a private credential.
// VITE_* names cannot be added through Cloud Secrets; read the public key at runtime instead.
export const getPushPublicKey = createServerFn({ method: "GET" }).handler(() => {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  if (!publicKey || !/^[A-Za-z0-9_-]{87}$/.test(publicKey)) return { publicKey: null };
  return { publicKey };
});

export const sendPushNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => pushMessageSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertPushAdmin(async () => {
      const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
        _user_id: context.userId, _role: "admin",
      });
      return !error && isAdmin === true;
    });
    const publicKey = process.env["VAPID_PUBLIC_KEY"];
    const privateKey = process.env["VAPID_PRIVATE_KEY"];
    if (!publicKey || !privateKey) throw new Error("Configure as chaves VAPID nos Secrets do Cloud");
    const { sendPushCampaign } = await import("@/lib/push.server");
    return sendPushCampaign(data, {
      publicKey, privateKey, subject: "https://gigashopping.lovable.app",
    });
  });