import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const productImageSchema = z.object({
  productId: z.string().trim().min(1).max(120),
});

export const getProductImageUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => productImageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: product, error } = await context.supabase
      .from("products")
      .select("image_url")
      .eq("id", data.productId)
      .maybeSingle();

    if (error) throw new Error("Não foi possível carregar a foto do produto");

    const imagePath = product?.image_url;
    if (!imagePath) return { imageUrl: null };
    if (/^https?:\/\//.test(imagePath)) return { imageUrl: imagePath };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("product-images")
      .createSignedUrl(imagePath, 3600);

    if (signError || !signed?.signedUrl) return { imageUrl: null };

    const publicSupabaseUrl = process.env["VITE_SUPABASE_URL"]?.replace(/\/+$/, "");
    const serverSupabaseUrl = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
    const imageUrl = publicSupabaseUrl && serverSupabaseUrl && signed.signedUrl.startsWith(`${serverSupabaseUrl}/`)
      ? `${publicSupabaseUrl}${signed.signedUrl.slice(serverSupabaseUrl.length)}`
      : signed.signedUrl;

    return { imageUrl };
  });
