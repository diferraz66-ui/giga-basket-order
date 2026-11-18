import { describe, expect, it } from "vitest";
import { createReceiptBlob } from "./receipt";
import type { Order } from "./operations";

const order: Order = {
  id: "1",
  user_id: "cliente",
  order_number: 1,
  customer_name: "Maria",
  customer_whatsapp: "5575999999999",
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
    await expect(
      createReceiptBlob({
        ...order,
        status: "completed",
        paid_at: "2026-01-01T11:00:00Z",
        confirmed_by: "admin",
        confirmed_by_name: "Admin",
        payment_proof_path: "1/current",
        payment_proof_amount: 7.5,
        payment_proof_validated_at: "2026-01-01T10:59:00Z",
        payment_proof_validated_total: 7.5,
      }),
    ).resolves.toBeInstanceOf(Blob);
  });
});
