import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Users, Settings2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatBRL } from "@/lib/order";
import { parseOrder, type Order } from "@/lib/operations";
import { createSeller, deleteSeller, adminUpdateTeamMemberPasswordFn } from "@/lib/team.functions";

type TeamMemberPermissions = {
  active: boolean; pode_ver_todos_pedidos: boolean; pode_editar_pedidos: boolean; pode_cancelar_pedidos: boolean;
  pode_ignorar_pedido_minimo: boolean; pode_anexar_pix: boolean; pode_enviar_orientacoes_pix: boolean;
  pode_cadastrar_produtos: boolean; pode_alterar_status_produtos: boolean; pode_ver_totais_financeiros: boolean;
};
type TeamMemberWithPermissions = Tables<"team_members"> & Partial<TeamMemberPermissions>;
const permissionDefaults: TeamMemberPermissions = {
  active: true, pode_ver_todos_pedidos: true, pode_editar_pedidos: true, pode_cancelar_pedidos: true,
  pode_ignorar_pedido_minimo: true, pode_anexar_pix: true, pode_enviar_orientacoes_pix: true,
  pode_cadastrar_produtos: true, pode_alterar_status_produtos: true, pode_ver_totais_financeiros: true,
};
const permissionLabels: Array<{ key: keyof TeamMemberPermissions; label: string; description: string }> = [
  { key: "pode_ver_todos_pedidos", label: "Ver todos os pedidos da loja", description: "Desativado: vê apenas os próprios pedidos." },
  { key: "pode_editar_pedidos", label: "Alterar pedido", description: "Editar itens e quantidades." },
  { key: "pode_cancelar_pedidos", label: "Cancelar pedidos", description: "Permite cancelar pedidos." },
  { key: "pode_ignorar_pedido_minimo", label: "Liberar pedido abaixo do mínimo", description: "Permite liberar pedidos abaixo do limite de compras." },
  { key: "pode_anexar_pix", label: "Anexar comprovante Pix", description: "Permite anexar comprovantes Pix." },
  { key: "pode_enviar_orientacoes_pix", label: "Enviar orientações Pix e cupom no WhatsApp", description: "Permite enviar instruções de pagamento e cupom." },
  { key: "pode_cadastrar_produtos", label: "Incluir produto", description: "Cadastro sujeito à aprovação do Admin." },
  { key: "pode_alterar_status_produtos", label: "Pausar / reativar produtos", description: "Controlar status de produtos esgotados no catálogo." },
  { key: "pode_ver_totais_financeiros", label: "Visualizar totais financeiros", description: "Ver faturamento e totais da loja." },
];

export function ReportsTeamPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [team, setTeam] = useState<Tables<"team_members">[]>([]);
  const [roles, setRoles] = useState<Tables<"user_roles">[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedMember, setSelectedMember] = useState<TeamMemberWithPermissions | null>(null);
  const [permissions, setPermissions] = useState<TeamMemberPermissions>(permissionDefaults);
  const [newPassword, setNewPassword] = useState("");
  const createSellerFn = useServerFn(createSeller);
  const deleteSellerFn = useServerFn(deleteSeller);
  const updatePasswordFn = useServerFn(adminUpdateTeamMemberPasswordFn);

  const load = useCallback(async () => {
    const [{ data: orderRows }, { data: members }, { data: roleRows }] = await Promise.all([
      supabase.from("orders").select("*"), supabase.from("team_members").select("*").order("created_at"), supabase.from("user_roles").select("*"),
    ]);
    setOrders((orderRows ?? []).map(parseOrder)); setTeam(members ?? []); setRoles(roleRows ?? []); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const report = useMemo(() => {
    const completed = orders.filter((order) => order.status === "completed" && order.paid_at);
    const now = new Date();
    const daily = completed.filter((order) => new Date(order.paid_at!).toDateString() === now.toDateString());
    const monthly = completed.filter((order) => { const date = new Date(order.paid_at!); return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear(); });
    const productMap = new Map<string, { name: string; quantity: number; total: number }>();
    const sellerMap = new Map<string, { name: string; orders: number; total: number }>();
    for (const order of completed) {
      for (const item of order.items) { const current = productMap.get(item.id) ?? { name: item.name, quantity: 0, total: 0 }; current.quantity += item.quantity; current.total += item.price * item.quantity; productMap.set(item.id, current); }
      const seller = order.seller_name ?? "Não informado"; const current = sellerMap.get(seller) ?? { name: seller, orders: 0, total: 0 }; current.orders += 1; current.total += Number(order.total); sellerMap.set(seller, current);
    }
    return { daily: daily.reduce((sum, order) => sum + Number(order.total), 0), monthly: monthly.reduce((sum, order) => sum + Number(order.total), 0), products: [...productMap.values()].sort((a, b) => b.quantity - a.quantity), sellers: [...sellerMap.values()].sort((a, b) => b.total - a.total) };
  }, [orders]);

  async function submitSeller(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await createSellerFn({ data: { fullName, username, password } }); toast.success("Vendedor cadastrado"); setFullName(""); setUsername(""); setPassword(""); await load(); }
    catch { toast.error("Não foi possível cadastrar. Confira os dados e se o login já existe."); } finally { setBusy(false); }
  }
  async function toggleSellerAccess(member: TeamMemberWithPermissions, next: boolean) {
    setBusy(true);
    try { const { error } = await supabase.from("team_members").update({ active: next } as never).eq("user_id", member.user_id); if (error) throw error; toast.success(next ? "Acesso do colaborador ativado" : "Acesso do colaborador bloqueado"); await load(); setPermissions((prev) => ({ ...prev, active: next })); setSelectedMember((prev) => prev ? ({ ...prev, active: next }) : prev); }
    catch { toast.error(next ? "Não foi possível ativar. O limite de 10 ativos pode ter sido atingido." : "Não foi possível bloquear o acesso."); } finally { setBusy(false); }
  }
  function openManagement(member: Tables<"team_members">) {
    const row = member as TeamMemberWithPermissions; setSelectedMember(row); setPermissions({ ...permissionDefaults, ...(row as Partial<TeamMemberPermissions>) }); setNewPassword("");
  }
  async function savePermissions() {
    if (!selectedMember) return; setBusy(true);
    try {
      const { error } = await supabase.rpc("admin_update_team_permissions", {
        p_user_id: selectedMember.user_id, p_pode_ver_todos_pedidos: permissions.pode_ver_todos_pedidos,
        p_pode_editar_pedidos: permissions.pode_editar_pedidos, p_pode_cancelar_pedidos: permissions.pode_cancelar_pedidos,
        p_pode_ignorar_pedido_minimo: permissions.pode_ignorar_pedido_minimo, p_pode_anexar_pix: permissions.pode_anexar_pix,
        p_pode_enviar_orientacoes_pix: permissions.pode_enviar_orientacoes_pix, p_pode_cadastrar_produtos: permissions.pode_cadastrar_produtos,
        p_pode_alterar_status_produtos: permissions.pode_alterar_status_produtos, p_pode_ver_totais_financeiros: permissions.pode_ver_totais_financeiros,
      } as never);
      if (error) throw error; toast.success("Permissões salvas"); await load(); setSelectedMember(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar as permissões"); } finally { setBusy(false); }
  }
  async function saveNewPassword() {
    if (!selectedMember) return; if (newPassword.length < 6) { toast.error("A senha precisa ter pelo menos 6 caracteres"); return; } setBusy(true);
    try { await updatePasswordFn({ data: { userId: selectedMember.user_id, password: newPassword } }); toast.success("Senha atualizada"); setNewPassword(""); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a senha"); } finally { setBusy(false); }
  }
  async function removeSeller(member: Tables<"team_members">) {
    if (!window.confirm(`Excluir o acesso de ${member.full_name}?`)) return; setBusy(true);
    try { await deleteSellerFn({ data: { userId: member.user_id } }); toast.success("Vendedor excluído"); if (selectedMember?.user_id === member.user_id) setSelectedMember(null); await load(); }
    catch { toast.error("Não foi possível excluir o vendedor"); } finally { setBusy(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;
  return <div className="space-y-8">
    <section>
      <h3 className="mb-3 text-lg uppercase">Relatórios de vendas</h3>
      <div className="grid gap-3 sm:grid-cols-3"><ReportCard label="Vendas hoje" value={formatBRL(report.daily)} /><ReportCard label="Vendas neste mês" value={formatBRL(report.monthly)} /><ReportCard label="Total de pedidos" value={String(orders.length)} /></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4"><h4 className="font-bold">Produtos mais vendidos</h4>{report.products.length === 0 ? <EmptyReport /> : <ul className="mt-3 space-y-3">{report.products.slice(0, 8).map((product) => <li key={product.name}><div className="flex justify-between gap-2 text-sm"><span>{product.name}</span><strong>{product.quantity} un.</strong></div><p className="text-xs text-muted-foreground">{formatBRL(product.total)}</p></li>)}</ul>}</div>
        <div className="rounded-2xl border border-border bg-card p-4"><h4 className="font-bold">Vendas por vendedor</h4>{report.sellers.length === 0 ? <EmptyReport /> : <ul className="mt-3 space-y-3">{report.sellers.map((seller) => <li key={seller.name} className="flex justify-between gap-2 text-sm"><span>{seller.name}<small className="block text-muted-foreground">{seller.orders} venda(s)</small></span><strong>{formatBRL(seller.total)}</strong></li>)}</ul>}</div>
      </div>
    </section>
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-lg uppercase"><Users className="size-5 text-primary" /> Equipe</h3><p className="mt-2 text-sm font-semibold">Colaboradores ativos: {team.filter((member) => member.active).length} / 10</p>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div><h4 className="text-sm font-bold">Vendedores e responsáveis</h4><ul className="mt-2 divide-y divide-border">{team.map((member) => { const memberRole = roles.find((item) => item.user_id === member.user_id)?.role; return <li key={member.user_id} className="flex items-center justify-between gap-3 py-3 text-sm">
          <button type="button" className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => openManagement(member)}><p className="font-bold">{member.full_name}</p><p className="text-xs text-muted-foreground">Login: {member.username} · {memberRole === "admin" ? "Admin/Financeiro" : "Vendedor"} · {member.active ? "Ativo" : "Bloqueado"}</p></button>
          {memberRole === "vendedor" && <div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void toggleSellerAccess(member as TeamMemberWithPermissions, !member.active)}>{member.active ? "Bloquear acesso" : "Ativar acesso"}</Button><Button size="icon" variant="ghost" className="shrink-0 text-destructive" aria-label={`Excluir ${member.full_name}`} onClick={() => void removeSeller(member)} disabled={busy}><Trash2 /></Button></div>}
        </li>; })}</ul></div>
        <form onSubmit={submitSeller} className="space-y-3 rounded-xl bg-muted p-4"><h4 className="flex items-center gap-2 text-sm font-bold"><Plus className="size-4" /> Cadastrar novo vendedor</h4>
          <div><Label htmlFor="seller-name">Nome do colaborador</Label><Input id="seller-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={3} /></div>
          <div><Label htmlFor="seller-login">Login (letras e números, sem espaços)</Label><Input id="seller-login" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))} required minLength={3} maxLength={30} pattern="[a-z0-9]+" autoComplete="off" /></div>
          <div><Label htmlFor="seller-password">Senha (mínimo 6 caracteres)</Label><Input id="seller-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={72} autoComplete="new-password" /></div>
          <Button type="submit" variant="cta" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Cadastrar vendedor</Button>
        </form>
      </div>
    </section>
    <Dialog open={!!selectedMember} onOpenChange={(open) => { if (!open) setSelectedMember(null); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="size-5" /> Gestão de Equipe / Permissões</DialogTitle><DialogDescription>Controle o acesso, senha e permissões de {selectedMember?.full_name}.</DialogDescription></DialogHeader>
        {selectedMember && <div className="space-y-6">
          <section className="rounded-xl border p-4"><div className="flex items-center justify-between gap-4"><div><p className="font-semibold">Liberar / Bloquear acesso do vendedor</p><p className="text-sm text-muted-foreground">{permissions.active ? "Acesso liberado" : "Acesso bloqueado"} · máximo de 10 ativos</p></div><Switch checked={permissions.active} disabled={busy} onCheckedChange={(next) => void toggleSellerAccess(selectedMember, next)} /></div></section>
          <section className="space-y-3 rounded-xl border p-4"><h4 className="flex items-center gap-2 font-semibold"><KeyRound className="size-4" /> Alterar Senha</h4><div><Label htmlFor="team-new-password">Nova senha</Label><Input id="team-new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} maxLength={72} autoComplete="new-password" placeholder="Mínimo de 6 caracteres" /></div><Button type="button" disabled={busy || newPassword.length < 6} onClick={() => void saveNewPassword()}><KeyRound className="size-4" /> Salvar Nova Senha</Button></section>
          <section className="space-y-3 rounded-xl border p-4"><h4 className="font-semibold">Permissões e Restrições da Equipe</h4>{permissionLabels.map(({ key, label, description }) => <div key={key} className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"><div className="min-w-0"><p className="font-medium">{label}</p><p className="text-xs text-muted-foreground">{description}</p></div><Switch checked={permissions[key]} disabled={busy} onCheckedChange={(checked) => setPermissions((prev) => ({ ...prev, [key]: checked }))} /></div>)}<Button type="button" className="w-full" disabled={busy} onClick={() => void savePermissions()}>{busy && <Loader2 className="animate-spin" />} Salvar Permissões</Button></section>
        </div>}
      </DialogContent>
    </Dialog>
  </div>;
}
function ReportCard({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-ink p-4 text-ink-foreground"><p className="text-xs uppercase text-ink-foreground/70">{label}</p><p className="mt-2 font-display text-2xl font-extrabold">{value}</p></div>; }
function EmptyReport() { return <p className="mt-4 text-sm text-muted-foreground">As vendas concluídas aparecerão aqui.</p>; }
