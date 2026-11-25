import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { parseOrder, type Order } from "@/lib/operations";
import type { StaffRole } from "@/lib/staff";
import { OrderCard } from "./OrderCard";
import { PaymentProofDialog } from "./PaymentProofDialog";
import { ReceiptDialog } from "./ReceiptDialog";

type CatalogProduct = Pick<Tables<"products">, "id" | "name" | "price" | "status" | "max_per_customer">;

export function OrdersPanel({ role, targetOrder }: { role: StaffRole; targetOrder?: string | null }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [proof, setProof] = useState<Order | null>(null);
  const [highlightedOrderNumber, setHighlightedOrderNumber] = useState<number | null>(null);
  const [targetHandled, setTargetHandled] = useState(false);

  const reload = useCallback(async () => {
    const [{ data, error }, { data: productRows, error: productError }] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, price, status, max_per_customer").order("name"),
    ]);
    if (error) toast.error("Não foi possível carregar os pedidos");
    else setOrders((data ?? []).map((row) => parseOrder(row)));
    if (productError) toast.error("Não foi possível carregar o catálogo para edição");
    else setProducts(productRows ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!targetOrder || loading || targetHandled) return;
    const numericTarget = Number(targetOrder.replace(/^#/, ""));
    const found = orders.find((order) => order.order_number === numericTarget || order.id === targetOrder);
    if (found) {
      setHighlightedOrderNumber(found.order_number);
      setTargetHandled(true);
      toast.success("Pedido localizado no painel");
    } else if (orders.length > 0) {
      setTargetHandled(true);
      toast.warning("Pedido não encontrado");
    }
  }, [targetOrder, loading, targetHandled, orders]);

  const active = useMemo(
    () =>
      orders.filter((order) => ["received", "in_progress", "awaiting_pix"].includes(order.status)),
    [orders],
  );
  const finished = useMemo(
    () => orders.filter((order) => order.status === "completed" || order.status === "cancelled"),
    [orders],
  );

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  return (
    <>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <OrderColumn title="Em andamento" orders={active} empty="Nenhum pedido em andamento.">
          {active.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              products={products}
              onChanged={reload}
              onReceipt={setReceipt}
              onProof={setProof}
              role={role}
              highlighted={highlightedOrderNumber === order.order_number}
            />
          ))}
        </OrderColumn>
        <OrderColumn title="Finalizados" orders={finished} empty="Nenhum pedido finalizado.">
          {finished.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              products={products}
              onChanged={reload}
              onReceipt={setReceipt}
              onProof={setProof}
              role={role}
            />
          ))}
        </OrderColumn>
      </div>
      {receipt && (
        <ReceiptDialog
          order={receipt}
          open={Boolean(receipt)}
          onOpenChange={(open) => !open && setReceipt(null)}
        />
      )}
      {proof && (
        <PaymentProofDialog
          order={proof}
          open={Boolean(proof)}
          onOpenChange={(open) => !open && setProof(null)}
        />
      )}
    </>
  );
}

function OrderColumn({
  title,
  orders,
  empty,
  children,
}: {
  title: string;
  orders: Order[];
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`column-${title.toLowerCase().replace(" ", "-")}`}>
      <div className="mb-3 flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-ink-foreground">
        <h2 id={`column-${title.toLowerCase().replace(" ", "-")}`} className="text-lg uppercase">
          {title}
        </h2>
        <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">
          {orders.length}
        </span>
      </div>
      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="space-y-4">{children}</div>
      )}
    </section>
  );
}
