import { describe, expect, it } from "vitest";
import { buildReceiptMessage, createReceiptBlob } from "./receipt";
import type { Order } from "./operations";

const order: Order = {
  id: "1",
  user_id: "cliente",
  order_number: 1,
  customer_name: "Maria",
  customer_whatsapp: "5575999999999",
  delivery_method: null,
  pickup_name: null,
  pickup_document: null,
  delivery_city: null,
  van_contact: null,
  items: [{ id: "p", name: "Produto", price: 7.5, quantity: 1 }],
  total: 7.5,
  status: "awaiting_pix",
  payment_method: "pix",
  seller_id: "v",
  seller_name: "Vendedor",
  confirmed_by: null,
  confirmed_by_name: null,
  paid_at: null,
  payment_proof_path: null,
  payment_proof_name: null,
  payment_proof_type: null,
  payment_proof_amount: null,
  payment_proof_validated_at: null,
  payment_proof_validated_total: null,
  cancellation_reason: null,
  cancelled_by: null,
  cancelled_by_name: null,
  cancelled_at: null,
  created_at: "2026-01-01T10:00:00Z",
  updated_at: "2026-01-01T10:00:00Z",
};

const paidOrder: Order = {
  ...order,
  status: "completed",
  paid_at: "2026-01-01T11:00:00Z",
  confirmed_by: "admin",
  confirmed_by_name: "Admin",
  payment_proof_path: "1/current",
  payment_proof_amount: 7.5,
  payment_proof_validated_at: "2026-01-01T10:59:00Z",
  payment_proof_validated_total: 7.5,
  delivery_method: "pickup",
  pickup_name: "João Souza",
  pickup_document: "123.456.789-00",
};

describe("cupom não fiscal", () => {
  it("não libera PDF antes da venda concluída e do pagamento confirmado", async () => {
    await expect(createReceiptBlob(order)).rejects.toThrow("só pode ser gerado após a confirmação");
  });

  it("não libera PDF de venda concluída sem comprovante validado", async () => {
    await expect(
      createReceiptBlob({
        ...order,
        status: "completed",
        paid_at: "2026-01-01T11:00:00Z",
        confirmed_by: "admin",
        confirmed_by_name: "Admin",
      }),
    ).rejects.toThrow("exige comprovante Pix validado");
  });

  it("libera PDF depois da validação do valor exato e da finalização", async () => {
    await expect(createReceiptBlob(paidOrder)).resolves.toBeInstanceOf(Blob);
  });

  it("texto do WhatsApp contém os dados oficiais e o cupom completo", () => {
    const message = buildReceiptMessage(paidOrder);
    expect(message).toContain("GIGA SHOPPING\nBAHIA MEGA SHOPPING IMPORTADOS LTDA");
    expect(message).toContain("CNPJ: 68.616.873/0001-67");
    expect(message).toContain("Rua Sete de Setembro, 141 - Térreo/Subsolo, Centro");
    expect(message).toContain("Santo Antônio de Jesus - BA | CEP: 44430-124");
    expect(message).toContain("WhatsApp: (75) 98178-5898");
    expect(message).toContain("CUPOM NÃO FISCAL - PEDIDO Nº #000001");
    expect(message).toContain("Cliente: Maria");
    expect(message).toContain("WhatsApp: (75) 99999-9999");
    expect(message).toContain("Recebimento: RETIRADA NA LOJA (Santo Antônio de Jesus - BA)");
    expect(message).toContain("Nome de quem vai retirar: João Souza");
    expect(message).toContain("CPF ou RG de quem vai retirar: 123.456.789-00");
    expect(message).toContain("• 1x Produto");
    expect(message).toContain("Unitário: R$ 7,50 | Subtotal: R$ 7,50");
    expect(message).toContain("VALOR TOTAL PAGO: R$ 7,50");
    expect(message).toContain("Forma de Pagamento: PIX (Comprovante Validado)");
    expect(message).toContain("Vendedor responsável: Vendedor");
    expect(message).toContain("Confirmado por: Admin");
    expect(message).toContain("Documento sem valor fiscal - Conferência interna GIGA Shopping.");
  });
});
