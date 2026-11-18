import { describe, expect, it } from "vitest";
import {
  buildOrderMessage,
  cartTotal,
  formatOrderNumber,
  whatsappLink,
  type CartItem,
} from "./order";

const items: CartItem[] = [
  { id: "a", name: "Kit 5 Potes Herméticos", price: 24.9, quantity: 2 },
  { id: "b", name: "Cubo Mágico 3x3", price: 7.5, quantity: 1 },
];

describe("pedido pelo WhatsApp", () => {
  it("número do pedido tem 6 dígitos com zeros à esquerda", () => {
    expect(formatOrderNumber(1)).toBe("#000001");
    expect(formatOrderNumber(1234)).toBe("#001234");
  });

  it("soma o total considerando as quantidades", () => {
    expect(cartTotal(items)).toBe(57.3);
  });

  it("mensagem tem cabeçalho, pedido, cliente, WhatsApp, itens e total", () => {
    const msg = buildOrderMessage({
      orderNumber: 7,
      customerName: "Maria Souza",
      customerWhatsapp: "(11) 98888-7777",
      items,
    });
    expect(msg).toContain("GIGA SHOPPING | NOVO PEDIDO");
    expect(msg).toContain("#000007");
    expect(msg).toContain("Maria Souza");
    expect(msg).toContain("(11) 98888-7777");
    expect(msg).toContain("2x Kit 5 Potes Herméticos");
    expect(msg).toContain("R$ 24,90 por unidade — Subtotal: R$ 49,80");
    expect(msg).toContain("Valor Total: R$ 57,30");
  });

  it("link do WhatsApp usa só os dígitos do número da loja", () => {
    expect(whatsappLink("+55 (11) 99999-9999", "Oi")).toBe("https://wa.me/5511999999999?text=Oi");
  });
});
