import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const bannerNameSchema = z.object({ name: z.string().trim().min(1).max(180) });
const uploadSchema = z.object({ base64: z.string().min(100).max(5_000_000), contentType: z.literal("image/webp") });

async function requireAdmin(userId: string, supabase: SupabaseClient) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Apenas Admin pode gerenciar banners");
}

export const listTopBanners = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage.from("product-images").list("banners", { limit: 100, sortBy: { column: "name", order: "asc" } });
  if (error) throw new Error("Não foi possível carregar os banners");
  const active = (data ?? []).filter(file => file.name.startsWith("active-") && file.name.endsWith(".webp"));
  const banners = await Promise.all(active.map(async file => {
    const name = `banners/${file.name}`;
    const { data: signed } = await supabaseAdmin.storage.from("product-images").createSignedUrl(name, 3600);
    return signed?.signedUrl ? { name: file.name, url: signed.signedUrl } : null;
  }));
  return banners.filter((banner): banner is { name: string; url: string } => Boolean(banner));
});

export const listAllTopBanners = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireAdmin(context.userId, context.supabase);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage.from("product-images").list("banners", { limit: 100, sortBy: { column: "name", order: "asc" } });
  if (error) throw new Error("Não foi possível carregar os banners");
  const rows = await Promise.all((data ?? []).filter(file => file.name.endsWith(".webp")).map(async file => {
    const { data: signed } = await supabaseAdmin.storage.from("product-images").createSignedUrl(`banners/${file.name}`, 3600);
    return { name: file.name, active: file.name.startsWith("active-"), url: signed?.signedUrl ?? "" };
  }));
  return rows;
});

export const uploadTopBanner = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(input => uploadSchema.parse(input)).handler(async ({ data, context }) => {
  await requireAdmin(context.userId, context.supabase);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bytes = Buffer.from(data.base64, "base64");
  if (bytes.byteLength > 3_000_000) throw new Error("Banner otimizado excede o limite de 3 MB");
  const name = `active-${randomUUID()}.webp`;
  const { error } = await supabaseAdmin.storage.from("product-images").upload(`banners/${name}`, bytes, { contentType: data.contentType, upsert: false });
  if (error) throw new Error("Não foi possível salvar o banner");
  return { ok: true as const };
});

export const setTopBannerActive = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(input => bannerNameSchema.extend({ active: z.boolean() }).parse(input)).handler(async ({ data, context }) => {
  await requireAdmin(context.userId, context.supabase);
  if (!/^(active|inactive)-[a-z0-9-]+\.webp$/.test(data.name)) throw new Error("Nome de banner inválido");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const id = data.name.replace(/^(active|inactive)-/, "");
  const nextName = `${data.active ? "active" : "inactive"}-${id}`;
  if (nextName === data.name) return { ok: true as const };
  const { error: copyError } = await supabaseAdmin.storage.from("product-images").copy(`banners/${data.name}`, `banners/${nextName}`);
  if (copyError) throw new Error("Não foi possível alterar o status do banner");
  await supabaseAdmin.storage.from("product-images").remove([`banners/${data.name}`]);
  return { ok: true as const };
});

export const deleteTopBanner = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(input => bannerNameSchema.parse(input)).handler(async ({ data, context }) => {
  await requireAdmin(context.userId, context.supabase);
  if (!/^(active|inactive)-[a-z0-9-]+\.webp$/.test(data.name)) throw new Error("Nome de banner inválido");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.storage.from("product-images").remove([`banners/${data.name}`]);
  if (error) throw new Error("Não foi possível excluir o banner");
  return { ok: true as const };
});
