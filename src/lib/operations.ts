import type { Tables } from "@/integrations/supabase/types";
import { formatBRL, formatOrderNumber, type CartItem } from "@/lib/order";
import type { OrderStatus } from "@/lib/staff";

export type OrderItem = CartItem & { subtotal?: number };
export type Order = Omit<Tables<"orders">, "items" | "status"> & {
  items: OrderItem[];
  status: OrderStatus;
};

export function parseOrder(row: Tables<"orders">): Order {
  return {
    ...row,
    status: row.status as OrderStatus,
    items: Array.isArray(row.items) ? (row.items as unknown as OrderItem[]) : [],
  };
}

export function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

export function buildPixMessage(order: Order) {
  return [
    `Olá, ${order.customer_name}! Aqui é ${order.seller_name ?? "o vendedor"} da GIGA SHOPPING.`,
    "",
    `Seu pedido ${formatOrderNumber(order.order_number)} está aguardando o Pix manual.`,
    `Valor total: ${formatBRL(Number(order.total))}.`,
    "Vou enviar a chave Pix por esta conversa. Depois de pagar, envie o comprovante aqui para conferência.",
    "O pagamento só será confirmado pelo Admin/Financeiro da loja.",
  ].join("\n");
}
