export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(value)
    .replace(/\u00a0/g, " ");
}

export function cartTotal(items: CartItem[]) {
  return Math.round(items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;
}

export function formatOrderNumber(n: number) {
  return `#${String(n).padStart(6, "0")}`;
}

export function buildOrderMessage(args: {
  orderNumber: number;
  customerName: string;
  customerWhatsapp: string;
  items: CartItem[];
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
    "*Produtos:*",
    ...lines,
    "",
    `*Valor Total: ${formatBRL(cartTotal(args.items))}*`,
  ].join("\n");
}

export function whatsappLink(phone: string, message: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
