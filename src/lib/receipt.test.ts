import { describe, expect, it } from "vitest";
import { createReceiptBlob } from "./receipt";
import type { Order } from "./operations";

const order: Order = {
  id: "1", user_id: "cliente", order_number: 1, customer_name: "Maria", customer_whatsapp: "5575999999999",
  items: [{ id: "p", name: "Produto", price: 7.5, quantity: 1 }], total: 7.5,
  status: "awaiting_pix", payment_method: "pix", seller_id: "v", seller_name: "Vendedor",
  confirmed_by: null, confirmed_by_name: null, paid_at: null,
  created_at: "2026-01-01T10:00:00Z", updated_at: "2026-01-01T10:00:00Z",
};

describe("comprovante não fiscal", () => {
  it("não libera PDF antes da venda concluída e do pagamento confirmado", async () => {
    await expect(createReceiptBlob(order)).rejects.toThrow("só pode ser gerado após a confirmação");
  });
});
