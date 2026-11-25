export const MINIMUM_ORDER_TOTAL = 75;
export const REFERENCE_UNIT_PRICE = 7.5;

export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  maxPerCustomer?: number;
};

export type DeliveryDetails =
  | {
      method: "pickup";
      pickupName: string;
      pickupDocument: string;
    }
  | {
      method: "van";
      deliveryCity: string;
      vanContact: string;
    };

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(value)
    .replace(/\u00a0/g, " ");
}

export function cartTotal(items: CartItem[]) {
  return Math.round(items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;
}

export function minimumOrderProgress(total: number) {
  const remaining = Math.max(0, Math.round((MINIMUM_ORDER_TOTAL - total) * 100) / 100);
  return {
    reached: total >= MINIMUM_ORDER_TOTAL,
    remaining,
    itemsRemaining: Math.ceil(remaining / REFERENCE_UNIT_PRICE),
    percent: Math.min(100, Math.max(0, (total / MINIMUM_ORDER_TOTAL) * 100)),
  };
}

export function isProductLimitReached(quantity: number, limit = 0) {
  return limit > 0 && quantity >= limit;
}

export function productLimitMessage(limit: number) {
  return `Limite máximo de ${limit} unidade(s) por cliente para este produto.`;
}

export function deliveryLines(delivery: DeliveryDetails) {
  if (delivery.method === "pickup") {
    return [
      "Recebimento: RETIRADA NA LOJA (Santo Antônio de Jesus - BA)",
      `Nome de quem vai retirar: ${delivery.pickupName}`,
      `CPF ou RG de quem vai retirar: ${delivery.pickupDocument}`,
    ];
  }
  return [
    "Recebimento: DESPACHO VIA VAN / TRANSPORTE (Interior)",
    `Cidade / Localidade de destino: ${delivery.deliveryCity}`,
    `Van / Transportador: ${delivery.vanContact}`,
    "Despesa de retirada e transporte: totalmente por conta do cliente",
  ];
}

export function formatOrderNumber(n: number) {
  return `#${String(n).padStart(6, "0")}`;
}

export function buildOrderMessage(args: {
  orderNumber: number;
  customerName: string;
  customerWhatsapp: string;
  items: CartItem[];
  delivery: DeliveryDetails;
}) {
  const lines = args.items.map(
    (i) =>
      `• ${i.quantity}x ${i.name}\n   ${formatBRL(i.price)} por unidade — Subtotal: ${formatBRL(i.price * i.quantity)}`,
  );
  return [
    "*GIGA SHOPPING | NOVO PEDIDO*",
    "",
    `*Pedido:* ${formatOrderNumber(args.orderNumber)}`,
    `*Cliente:* ${args.customerName}`,
    `*WhatsApp:* ${args.customerWhatsapp}`,
    "",
    ...deliveryLines(args.delivery),
    "",
    "*Produtos:*",
    ...lines,
    "",
    `*Valor Total: ${formatBRL(cartTotal(args.items))}*`,
    "",
    `🔗 Abrir pedido no painel: ${typeof window !== "undefined" ? window.location.origin : ""}/area-restrita?pedido=${args.orderNumber}`,
  ].join("\n");
}

export function whatsappLink(phone: string, message: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
