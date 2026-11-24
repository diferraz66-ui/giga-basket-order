import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { staffAuthPassword } from "@/lib/staff";

const createSellerSchema = z.object({
  fullName: z.string().trim().min(3).max(100),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/),
  email: z.string().trim().email().max(254),
  password: z.string().min(3).max(72),
});

export const createSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => createSellerSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Somente Admin/Financeiro pode cadastrar vendedores");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: staffAuthPassword(data.password),
      email_confirm: true,
      user_metadata: { staff: true, full_name: data.fullName, username: data.username },
    });
    if (error || !created.user) throw new Error("Não foi possível criar o vendedor. Confira se o login já existe.");

    const { error: teamError } = await supabaseAdmin.from("team_members").insert({
      user_id: created.user.id,
      username: data.username,
      full_name: data.fullName,
    });
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: created.user.id,
      role: "vendedor",
    });
    if (teamError || roleError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error("Não foi possível concluir o cadastro do vendedor");
    }
    return { ok: true as const };
  });

export const deleteSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Somente Admin/Financeiro pode excluir vendedores");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sellerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .eq("role", "vendedor")
      .maybeSingle();
    if (!sellerRole) throw new Error("Somente contas de vendedor podem ser excluídas");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error("Não foi possível excluir o vendedor");
    return { ok: true as const };
  });
