import { normalizeWhatsapp, whatsappToLoginEmail } from "./phone";

export const RESET_GENERIC_ERROR =
  "Não foi possível validar os dados informados. Confira as informações ou fale com a loja pelo WhatsApp.";

export function normalizeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function registerCustomer(d: { full_name: string; whatsapp: string; birth_date: string; password: string; accepts_offers: boolean }) {
  const digits = normalizeWhatsapp(d.whatsapp);
  if (!digits) return { success: false as const, error: "WhatsApp inválido." };
  const email = whatsappToLoginEmail(digits);
  const db = await admin();
  const { data: existing } = await db.from("profiles").select("id").eq("whatsapp", digits).maybeSingle();
  const exists = existing ? true : false;
  if (exists) return { success: false as const, error: "Este WhatsApp já possui cadastro. Faça login ou clique em Esqueci minha senha." };
  const { data, error } = await db.auth.admin.createUser({
    email, password: d.password, email_confirm: true,
    user_metadata: { full_name: d.full_name.trim(), whatsapp: digits, marketing_opt_in: d.accepts_offers },
  });
  if (error || !data.user) {
    const dup = /already|registered|exists/i.test(error?.message ?? "");
    return { success: false as const, error: dup ? "Este WhatsApp já possui cadastro. Faça login ou clique em Esqueci minha senha." : "Não foi possível concluir o cadastro." };
  }
  const { error: pErr } = await db.from("profiles").upsert({
    id: data.user.id, full_name: d.full_name.trim(), whatsapp: digits, birth_date: d.birth_date,
    accepts_offers: d.accepts_offers, marketing_opt_in: d.accepts_offers,
    marketing_opt_in_at: d.accepts_offers ? new Date().toISOString() : null,
  });
  if (pErr) console.error("profile upsert failed", pErr.message);
  return { success: true as const, internal_email: email };
}

export async function resetCustomerPassword(d: { whatsapp: string; full_name: string; birth_date: string; new_password: string }) {
  const digits = normalizeWhatsapp(d.whatsapp);
  if (!digits) return { success: false as const, error: RESET_GENERIC_ERROR };
  const db = await admin();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await db.from("password_reset_attempts").select("id", { count: "exact", head: true })
    .eq("whatsapp_digits", digits).gte("attempted_at", since);
  if ((count ?? 0) >= 5) return { success: false as const, error: "Muitas tentativas. Aguarde um pouco e tente novamente." };
  await db.from("password_reset_attempts").insert({ whatsapp_digits: digits });
  const { data: p } = await db.from("profiles").select("id, full_name, birth_date").eq("whatsapp", digits).maybeSingle();
  if (!p || !p.birth_date || p.birth_date !== d.birth_date || normalizeName(p.full_name) !== normalizeName(d.full_name)) {
    return { success: false as const, error: RESET_GENERIC_ERROR };
  }
  const { error } = await db.auth.admin.updateUserById(p.id, { password: d.new_password });
  if (error) return { success: false as const, error: RESET_GENERIC_ERROR };
  return { success: true as const, internal_email: whatsappToLoginEmail(digits) };
}
