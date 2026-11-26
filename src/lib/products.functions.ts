import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const productImageSchema = z.object({
  productId: z.string().trim().min(1).max(120),
});

export const getProductImageUrl = createServerFn({ method: "POST" })
  .inputValidator((input) => productImageSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabasePublic = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });
    const { data: product, error } = await supabasePublic
      .from("products")
      .select("image_url, imagens")
      .eq("id", data.productId)
      .eq("status_aprovacao", "aprovado")
      .maybeSingle();

    if (error) throw new Error("Não foi possível carregar a foto do produto");

    const paths = [product?.image_url, ...(product?.imagens ?? [])].filter((path): path is string => Boolean(path)).slice(0, 3);
    if (!paths.length) return { imageUrl: null, imageUrls: [] as string[] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const imageUrls = await Promise.all(paths.map(async imagePath => {
      if (/^https?:\/\//.test(imagePath)) return imagePath;
      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from("product-images")
        .createSignedUrl(imagePath, 3600);
      if (signError || !signed?.signedUrl) return null;
      const publicSupabaseUrl = process.env["VITE_SUPABASE_URL"]?.replace(/\/+$/, "");
      const serverSupabaseUrl = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
      return publicSupabaseUrl && serverSupabaseUrl && signed.signedUrl.startsWith(`${serverSupabaseUrl}/`)
        ? `${publicSupabaseUrl}${signed.signedUrl.slice(serverSupabaseUrl.length)}`
        : signed.signedUrl;
    }));
    const valid = imageUrls.filter((url): url is string => Boolean(url));
    return { imageUrl: valid[0] ?? null, imageUrls: valid };
  });

export const getPendingProductImageUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => productImageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: product, error } = await context.supabase.from("products")
      .select("image_url,imagens,status_aprovacao").eq("id", data.productId).maybeSingle();
    const paths = [product?.image_url, ...(product?.imagens ?? [])].filter((path): path is string => Boolean(path)).slice(0, 3);
    if (error || !paths.length) return { imageUrl: null, imageUrls: [] as string[] };
    // The authenticated row read above authorizes access before privileged signing.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const publicUrl = process.env["VITE_SUPABASE_URL"]?.replace(/\/+$/, "");
    const serverUrl = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
    const imageUrls = await Promise.all(paths.map(async path => {
      if (/^https?:\/\//.test(path)) return path;
      const { data: signed, error: signError } = await supabaseAdmin.storage.from("product-images").createSignedUrl(path, 3600);
      if (signError || !signed?.signedUrl) return null;
      return publicUrl && serverUrl && signed.signedUrl.startsWith(`${serverUrl}/`)
        ? `${publicUrl}${signed.signedUrl.slice(serverUrl.length)}` : signed.signedUrl;
    }));
    const valid = imageUrls.filter((url): url is string => Boolean(url));
    return { imageUrl: valid[0] ?? null, imageUrls: valid };
  });
