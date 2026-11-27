import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { staffAuthPassword } from "@/lib/staff";

const createSellerSchema = z.object({
  fullName: z.string().trim().min(3).max(100),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9]{3,30}$/),
  password: z.string().min(6).max(72),
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
    const { count: activeCount, error: countError } = await supabaseAdmin
      .from("team_members")
      .select("user_id", { count: "exact", head: true })
      .eq("active", true);
    if (countError) throw new Error("Não foi possível verificar o limite de colaboradores ativos");
    if ((activeCount ?? 0) >= 10) throw new Error("Limite de 10 colaboradores ativos atingido");
    const technicalEmail = `${data.username}@equipe.gigashopping.app`;
    const { data: existingLogin } = await supabaseAdmin
      .from("team_members")
      .select("user_id")
      .eq("username", data.username)
      .maybeSingle();
    if (existingLogin) throw new Error("Este login já está em uso");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: technicalEmail,
      password: staffAuthPassword(data.password),
      email_confirm: true,
      user_metadata: { staff: true, full_name: data.fullName, username: data.username },
    });
    if (error || !created.user) throw new Error("Não foi possível criar o vendedor. Confira se o login já existe.");

    const { error: teamError } = await supabaseAdmin.from("team_members").insert({
      user_id: created.user.id,
      username: data.username,
      full_name: data.fullName,
      active: true,
      pode_ver_todos_pedidos: true,
      pode_editar_pedidos: true,
      pode_cancelar_pedidos: true,
      pode_ignorar_pedido_minimo: true,
      pode_anexar_pix: true,
      pode_enviar_orientacoes_pix: true,
      pode_cadastrar_produtos: true,
      pode_alterar_status_produtos: true,
      pode_ver_totais_financeiros: true,
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


const adminUpdateTeamMemberPasswordSchema = z.object({ userId: z.string().uuid(), password: z.string().min(6).max(72) });

export const adminUpdateTeamMemberPasswordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => adminUpdateTeamMemberPasswordSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || !isAdmin) throw new Error("Somente Admin pode alterar senhas da equipe");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member, error: memberError } = await supabaseAdmin.from("team_members").select("user_id").eq("user_id", data.userId).maybeSingle();
    if (memberError || !member) throw new Error("Colaborador não encontrado");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: staffAuthPassword(data.password) });
    if (error) throw new Error("Não foi possível atualizar a senha do colaborador");
    return { ok: true as const };
  });
