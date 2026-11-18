import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, Loader2, MessageCircle, Play, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatBRL, formatOrderNumber, whatsappLink } from "@/lib/order";
import { formatWhatsapp } from "@/lib/phone";
import { buildPixMessage, formatDateTime, parseOrder, type Order } from "@/lib/operations";
import { orderStatusLabels, type OrderStatus, type StaffRole } from "@/lib/staff";
import { ReceiptDialog } from "./ReceiptDialog";

const filters: Array<{ id: "all" | OrderStatus; label: string }> = [
  { id: "all", label: "Todos" },
  ...Object.entries(orderStatusLabels).map(([id, label]) => ({ id: id as OrderStatus, label })),
];

export function OrdersPanel({ role }: { role: StaffRole }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Order | null>(null);

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Não foi possível carregar os pedidos");
    else setOrders((data ?? []).map((row: Tables<"orders">) => parseOrder(row)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visible = useMemo(() => orders.filter((order) => filter === "all" || order.status === filter), [orders, filter]);

  async function updateStatus(order: Order, status: OrderStatus) {
    setBusy(order.id);
    const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
    setBusy(null);
    if (error) {
      toast.error(status === "completed" ? "Pagamento não confirmado. Confira se o atendimento foi iniciado." : "Não foi possível atualizar o pedido");
      return false;
    }
    await reload();
    return true;
  }

  async function sendPixInstructions(order: Order) {
    const popup = window.open("", "_blank");
    setBusy(order.id);
    const { data, error } = await supabase.from("orders").update({ status: "awaiting_pix" }).eq("id", order.id).select().single();
    setBusy(null);
    if (error || !data) {
      popup?.close();
      toast.error("Inicie o atendimento antes de enviar as orientações do Pix");
      return;
    }
    const updated = parseOrder(data);
    const link = whatsappLink(order.customer_whatsapp, buildPixMessage(updated));
    if (popup) popup.location.href = link;
    else toast.info("O navegador bloqueou a nova aba. Clique novamente para abrir o WhatsApp.");
    await reload();
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <section>
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-3">
        {filters.map((item) => (
          <button key={item.id} onClick={() => setFilter(item.id)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${filter === item.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {item.label} ({item.id === "all" ? orders.length : orders.filter((order) => order.status === item.id).length})
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">Nenhum pedido nesta situação.</div>
      ) : (
        <div className="mt-3 space-y-4">
          {visible.map((order) => (
            <article key={order.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-extrabold">{formatOrderNumber(order.order_number)}</h3>
                    <Badge variant={order.status === "cancelled" ? "destructive" : order.status === "completed" ? "default" : "secondary"}>
                      {orderStatusLabels[order.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm font-bold">{order.customer_name} · {formatWhatsapp(order.customer_whatsapp)}</p>
                  <p className="text-xs text-muted-foreground">Recebido em {formatDateTime(order.created_at)}</p>
                </div>
                <p className="font-display text-2xl font-extrabold text-primary">{formatBRL(Number(order.total))}</p>
              </div>
              <ul className="mt-4 divide-y divide-border rounded-xl bg-muted px-3 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3 py-2">
                    <span>{item.quantity}x {item.name}</span>
                    <span className="shrink-0 font-bold">{formatBRL(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              {order.seller_name && <p className="mt-3 text-xs text-muted-foreground">Vendedor: <strong>{order.seller_name}</strong></p>}
              {order.status === "completed" && (
                <p className="mt-1 text-xs text-muted-foreground">Pix confirmado por <strong>{order.confirmed_by_name}</strong> em {formatDateTime(order.paid_at)}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {order.status === "received" && (
                  <Button size="sm" onClick={() => void updateStatus(order, "in_progress")} disabled={busy === order.id}>
                    <Play /> Iniciar atendimento
                  </Button>
                )}
                {order.status === "in_progress" && (
                  <Button size="sm" variant="whatsapp" onClick={() => void sendPixInstructions(order)} disabled={busy === order.id}>
                    <MessageCircle /> Enviar orientações do Pix
                  </Button>
                )}
                {role === "admin" && order.status === "awaiting_pix" && (
                  <Button size="sm" variant="cta" onClick={() => void updateStatus(order, "completed")} disabled={busy === order.id}>
                    <CheckCircle2 /> Confirmar pagamento e finalizar venda
                  </Button>
                )}
                {order.status === "completed" && (
                  <Button size="sm" variant="outline" onClick={() => setReceipt(order)}><FileText /> Gerar comprovante PDF</Button>
                )}
                {role === "admin" && order.status !== "completed" && order.status !== "cancelled" && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void updateStatus(order, "cancelled")} disabled={busy === order.id}>
                    <XCircle /> Cancelar pedido
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {receipt && <ReceiptDialog order={receipt} open={Boolean(receipt)} onOpenChange={(open) => !open && setReceipt(null)} />}
    </section>
  );
}
