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

export type TeamMemberPermissions = {
  active: boolean;
  pode_ver_todos_pedidos: boolean;
  pode_editar_pedidos: boolean;
  pode_cancelar_pedidos: boolean;
  pode_ignorar_pedido_minimo: boolean;
  pode_anexar_pix: boolean;
  pode_enviar_orientacoes_pix: boolean;
  pode_cadastrar_produtos: boolean;
  pode_alterar_status_produtos: boolean;
  pode_ver_totais_financeiros: boolean;
};

const permissionDefaults: TeamMemberPermissions = {
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
};

type CatalogProduct = Pick<Tables<"products">, "id" | "name" | "price" | "status" | "max_per_customer">;

export function OrdersPanel({ role, targetOrder, permissions, currentUserId }: {
  role: StaffRole;
  targetOrder?: string | null;
  permissions?: TeamMemberPermissions;
  currentUserId?: string;
}) {
  const effectivePermissions = { ...permissionDefaults, ...permissions };
  const [resolvedUserId, setResolvedUserId] = useState<string | undefined>(currentUserId);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [proof, setProof] = useState<Order | null>(null);
  const [highlightedOrderNumber, setHighlightedOrderNumber] = useState<number | null>(null);
  const [targetHandled, setTargetHandled] = useState(false);

  useEffect(() => {
    if (currentUserId) {
      setResolvedUserId(currentUserId);
      return;
    }
    if (role === "vendedor") {
      void supabase.auth.getUser().then(({ data }) => setResolvedUserId(data.user?.id));
    }
  }, [currentUserId, role]);

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

  const visibleOrders = useMemo(() => {
    if (role === "admin" || effectivePermissions.pode_ver_todos_pedidos) return orders;
    if (!resolvedUserId) return [];
    return orders.filter((order) => (order as Order & { seller_id?: string | null }).seller_id === resolvedUserId);
  }, [orders, role, effectivePermissions.pode_ver_todos_pedidos, resolvedUserId]);

  const active = useMemo(
    () => visibleOrders.filter((order) => ["received", "in_progress", "awaiting_pix"].includes(order.status)),
    [visibleOrders],
  );
  const finished = useMemo(
    () => visibleOrders.filter((order) => order.status === "completed" || order.status === "cancelled"),
    [visibleOrders],
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
              permissions={permissions}
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
              permissions={permissions}
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
