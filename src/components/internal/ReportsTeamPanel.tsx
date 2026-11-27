import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatBRL } from "@/lib/order";
import { parseOrder, type Order } from "@/lib/operations";
import { createSeller, deleteSeller } from "@/lib/team.functions";

export function ReportsTeamPanel() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [team, setTeam] = useState<Tables<"team_members">[]>([]);
  const [roles, setRoles] = useState<Tables<"user_roles">[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const createSellerFn = useServerFn(createSeller);
  const deleteSellerFn = useServerFn(deleteSeller);

  const load = useCallback(async () => {
    const [{ data: orderRows }, { data: members }, { data: roleRows }] = await Promise.all([
      supabase.from("orders").select("*"),
      supabase.from("team_members").select("*").order("created_at"),
      supabase.from("user_roles").select("*"),
    ]);
    setOrders((orderRows ?? []).map(parseOrder));
    setTeam(members ?? []);
    setRoles(roleRows ?? []);
    setLoading(false);
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
      for (const item of order.items) {
        const current = productMap.get(item.id) ?? { name: item.name, quantity: 0, total: 0 };
        current.quantity += item.quantity;
        current.total += item.price * item.quantity;
        productMap.set(item.id, current);
      }
      const seller = order.seller_name ?? "Não informado";
      const current = sellerMap.get(seller) ?? { name: seller, orders: 0, total: 0 };
      current.orders += 1;
      current.total += Number(order.total);
      sellerMap.set(seller, current);
    }
    return {
      daily: daily.reduce((sum, order) => sum + Number(order.total), 0),
      monthly: monthly.reduce((sum, order) => sum + Number(order.total), 0),
      products: [...productMap.values()].sort((a, b) => b.quantity - a.quantity),
      sellers: [...sellerMap.values()].sort((a, b) => b.total - a.total),
    };
  }, [orders]);

  async function submitSeller(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await createSellerFn({ data: { fullName, username, password } });
      toast.success("Vendedor cadastrado");
      setFullName(""); setUsername(""); setPassword("");
      await load();
    } catch {
      toast.error("Não foi possível cadastrar. Confira os dados e se o login já existe.");
    } finally { setBusy(false); }
  }

  async function removeSeller(member: Tables<"team_members">) {
    if (!window.confirm(`Excluir o acesso de ${member.full_name}?`)) return;
    setBusy(true);
    try {
      await deleteSellerFn({ data: { userId: member.user_id } });
      toast.success("Vendedor excluído");
      await load();
    } catch {
      toast.error("Não foi possível excluir o vendedor");
    } finally { setBusy(false); }
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-lg uppercase">Relatórios de vendas</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <ReportCard label="Vendas hoje" value={formatBRL(report.daily)} />
          <ReportCard label="Vendas neste mês" value={formatBRL(report.monthly)} />
          <ReportCard label="Total de pedidos" value={String(orders.length)} />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <h4 className="font-bold">Produtos mais vendidos</h4>
            {report.products.length === 0 ? <EmptyReport /> : <ul className="mt-3 space-y-3">{report.products.slice(0, 8).map((product) => <li key={product.name}><div className="flex justify-between gap-2 text-sm"><span>{product.name}</span><strong>{product.quantity} un.</strong></div><p className="text-xs text-muted-foreground">{formatBRL(product.total)}</p></li>)}</ul>}
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <h4 className="font-bold">Vendas por vendedor</h4>
            {report.sellers.length === 0 ? <EmptyReport /> : <ul className="mt-3 space-y-3">{report.sellers.map((seller) => <li key={seller.name} className="flex justify-between gap-2 text-sm"><span>{seller.name}<small className="block text-muted-foreground">{seller.orders} venda(s)</small></span><strong>{formatBRL(seller.total)}</strong></li>)}</ul>}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-lg uppercase"><Users className="size-5 text-primary" /> Equipe</h3>
        <p className="mt-2 text-sm font-semibold">Colaboradores ativos: {team.filter((member) => member.active).length} / 10</p>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-sm font-bold">Vendedores e responsáveis</h4>
            <ul className="mt-2 divide-y divide-border">{team.map((member) => {
              const memberRole = roles.find((item) => item.user_id === member.user_id)?.role;
              return <li key={member.user_id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div><p className="font-bold">{member.full_name}</p><p className="text-xs text-muted-foreground">Login: {member.username} · {memberRole === "admin" ? "Admin/Financeiro" : "Vendedor"} · {member.active ? "Ativo" : "Inativo"}</p></div>
                {memberRole === "vendedor" && <Button size="icon" variant="ghost" className="shrink-0 text-destructive" aria-label={`Excluir ${member.full_name}`} onClick={() => void removeSeller(member)} disabled={busy}><Trash2 /></Button>}
              </li>;
            })}</ul>
          </div>
          <form onSubmit={submitSeller} className="space-y-3 rounded-xl bg-muted p-4">
            <h4 className="flex items-center gap-2 text-sm font-bold"><Plus className="size-4" /> Cadastrar novo vendedor</h4>
            <div><Label htmlFor="seller-name">Nome do colaborador</Label><Input id="seller-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={3} /></div>
            <div><Label htmlFor="seller-login">Login (letras e números, sem espaços)</Label><Input id="seller-login" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))} required minLength={3} maxLength={30} pattern="[a-z0-9]+" autoComplete="off" /></div>
            <div><Label htmlFor="seller-password">Senha (mínimo 6 caracteres)</Label><Input id="seller-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={72} autoComplete="new-password" /></div>
            <Button type="submit" variant="cta" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Cadastrar vendedor</Button>
          </form>
        </div>
      </section>
    </div>
  );
}

function ReportCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-ink p-4 text-ink-foreground"><p className="text-xs uppercase text-ink-foreground/70">{label}</p><p className="mt-2 font-display text-2xl font-extrabold">{value}</p></div>;
}
function EmptyReport() { return <p className="mt-4 text-sm text-muted-foreground">As vendas concluídas aparecerão aqui.</p>; }
