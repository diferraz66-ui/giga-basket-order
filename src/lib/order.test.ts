import { describe, expect, it } from "vitest";
import {
  buildOrderMessage,
  cartTotal,
  formatOrderNumber,
  isProductLimitReached,
  minimumOrderProgress,
  whatsappLink,
  type CartItem,
  type DeliveryDetails,
} from "./order";

const items: CartItem[] = [
  { id: "a", name: "Kit 5 Potes Herméticos", price: 24.9, quantity: 2 },
  { id: "b", name: "Cubo Mágico 3x3", price: 7.5, quantity: 1 },
];

const pickup: DeliveryDetails = {
  method: "pickup",
  pickupName: "João Souza",
  pickupDocument: "123.456.789-00",
};

describe("pedido pelo WhatsApp", () => {
  it("número do pedido tem 6 dígitos com zeros à esquerda", () => {
    expect(formatOrderNumber(1)).toBe("#000001");
    expect(formatOrderNumber(1234)).toBe("#001234");
  });

  it("soma o total considerando as quantidades", () => {
    expect(cartTotal(items)).toBe(57.3);
  });

  it("calcula quantos itens faltam para atingir o mínimo dinâmico", () => {
    expect(minimumOrderProgress(22.5, 7, 10)).toMatchObject({
      reached: false,
      remaining: 3,
      itemsRemaining: 3,
      percent: 70,
    });
  });

  it("libera a finalização quando a quantidade mínima dinâmica é atingida", () => {
    expect(minimumOrderProgress(25, 10, 10)).toMatchObject({
      reached: true,
      remaining: 0,
      itemsRemaining: 0,
      percent: 100,
    });
  });

  it("respeita um mínimo configurado diferente de dez unidades", () => {
    expect(minimumOrderProgress(40, 5, 5).reached).toBe(true);
    expect(minimumOrderProgress(40, 4, 5).reached).toBe(false);
  });

  it("bloqueia a segunda unidade quando o histórico já consumiu o limite 1", () => {
    expect(isProductLimitReached(1, 1)).toBe(true);
    expect(isProductLimitReached(0, 1)).toBe(false);
  });

  it("limite 0 mantém o produto sem limite", () => {
    expect(isProductLimitReached(99, 0)).toBe(false);
  });

  it("mensagem tem pedido, cliente, retirada, itens e total", () => {
    const msg = buildOrderMessage({
      orderNumber: 7,
      customerName: "Maria Souza",
      customerWhatsapp: "(11) 98888-7777",
      items,
      delivery: pickup,
    });
    expect(msg).toContain("GIGA SHOPPING | NOVO PEDIDO");
    expect(msg).toContain("#000007");
    expect(msg).toContain("Maria Souza");
    expect(msg).toContain("(11) 98888-7777");
    expect(msg).toContain("Recebimento: RETIRADA NA LOJA (Santo Antônio de Jesus - BA)");
    expect(msg).toContain("Nome de quem vai retirar: João Souza");
    expect(msg).toContain("CPF ou RG de quem vai retirar: 123.456.789-00");
    expect(msg).toContain("2x Kit 5 Potes Herméticos");
    expect(msg).toContain("R$ 24,90 por unidade — Subtotal: R$ 49,80");
    expect(msg).toContain("Valor Total: R$ 57,30");
  });

  it("mensagem de Van tem destino, transportador e frete por conta do cliente", () => {
    const msg = buildOrderMessage({
      orderNumber: 8,
      customerName: "Maria Souza",
      customerWhatsapp: "(11) 98888-7777",
      items,
      delivery: { method: "van", deliveryCity: "Cruz das Almas", vanContact: "A combinar" },
    });
    expect(msg).toContain("Recebimento: DESPACHO VIA VAN / TRANSPORTE (Interior)");
    expect(msg).toContain("Cidade / Localidade de destino: Cruz das Almas");
    expect(msg).toContain("Van / Transportador: A combinar");
    expect(msg).toContain("Despesa de retirada e transporte: totalmente por conta do cliente");
  });

  it("link do WhatsApp usa só os dígitos do número da loja", () => {
    expect(whatsappLink("+55 (11) 99999-9999", "Oi")).toBe("https://wa.me/5511999999999?text=Oi");
  });
});
