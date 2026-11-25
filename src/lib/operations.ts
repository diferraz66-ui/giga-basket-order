import type { Tables } from "@/integrations/supabase/types";
import {
  deliveryLines,
  formatBRL,
  formatOrderNumber,
  type CartItem,
  type DeliveryDetails,
} from "@/lib/order";
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

export function orderDeliveryLines(order: Order) {
  let delivery: DeliveryDetails | null = null;
  if (order.delivery_method === "pickup" && order.pickup_name && order.pickup_document) {
    delivery = {
      method: "pickup",
      pickupName: order.pickup_name,
      pickupDocument: order.pickup_document,
    };
  } else if (order.delivery_method === "van" && order.delivery_city && order.van_contact) {
    delivery = {
      method: "van",
      deliveryCity: order.delivery_city,
      vanContact: order.van_contact,
    };
  }
  return delivery ? deliveryLines(delivery) : ["Recebimento: não informado"];
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
    `Olá, ${order.customer_name}! Aqui é Vendedor GIGA da GIGA SHOPPING.`,
    "",
    `Seu pedido ${formatOrderNumber(order.order_number)} está aguardando o Pix manual.`,
    `Valor total: ${formatBRL(Number(order.total))}.`,
    "",
    "*PAGAMENTO SOMENTE VIA PIX*",
    "*Chave Pix (CNPJ):* 68.616.873/0001-67",
    "*Banco:* Itaú",
    "*Favorecido:* BAHIA MEGA SHOPPING IMPORTADOS LTDA (GIGA SHOPPING)",
    "",
    "Depois de pagar, envie o comprovante aqui para conferência.",
    "O pagamento só será confirmado pelo Admin/Financeiro da loja.",
  ].join("\n");
}
