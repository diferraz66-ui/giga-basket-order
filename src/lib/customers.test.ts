import { describe, expect, it } from "vitest";
import type { Tables } from "@/integrations/supabase/types";
import { customersToCsv, filterCustomers, summarizeCustomers } from "./customers";
import type { Order } from "./operations";

const profiles: Tables<"profiles">[] = [
  {
    id: "a",
    full_name: "Ana",
    whatsapp: "5511999999999",
    marketing_opt_in: true,
    marketing_opt_in_at: "2026-01-01T12:00:00Z",
    created_at: "2026-01-01T10:00:00Z",
    updated_at: "2026-01-01T10:00:00Z",
  },
  {
    id: "b",
    full_name: "Beto",
    whatsapp: "5511888888888",
    marketing_opt_in: false,
    marketing_opt_in_at: null,
    created_at: "2026-01-02T10:00:00Z",
    updated_at: "2026-01-02T10:00:00Z",
  },
];

function order(id: string, user_id: string, status: Order["status"], total: number): Order {
  return {
    id,
    user_id,
    status,
    total,
    order_number: 1,
    customer_name: "Cliente",
    customer_whatsapp: "5511",
    items: [],
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    payment_method: "pix",
    seller_id: null,
    seller_name: null,
    confirmed_by: null,
    confirmed_by_name: null,
    paid_at: status === "completed" ? "2026-01-03" : null,
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
  };
}

const orders = [
  order("1", "a", "completed", 7.5),
  order("2", "a", "completed", 15),
  order("3", "a", "cancelled", 100),
];

describe("clientes GIGA", () => {
  it("total gasto considera somente vendas concluídas", () => {
    const customers = summarizeCustomers(profiles, orders);
    expect(customers[0]?.totalSpent).toBe(22.5);
    expect(customers[1]?.totalSpent).toBe(0);
  });

  it("recorrente é o cliente com pelo menos duas compras concluídas", () => {
    const customers = summarizeCustomers(profiles, orders);
    expect(filterCustomers(customers, "recurring").map((item) => item.id)).toEqual(["a"]);
    expect(filterCustomers(customers, "buyers").map((item) => item.id)).toEqual(["a"]);
    expect(filterCustomers(customers, "never").map((item) => item.id)).toEqual(["b"]);
  });

  it("filtros de publicidade respeitam a autorização", () => {
    const customers = summarizeCustomers(profiles, orders);
    expect(filterCustomers(customers, "opted_in").map((item) => item.id)).toEqual(["a"]);
    expect(filterCustomers(customers, "not_opted_in").map((item) => item.id)).toEqual(["b"]);
  });

  it("CSV tem cabeçalho e dados do cliente para abrir no Excel", () => {
    const csv = customersToCsv(summarizeCustomers(profiles, orders));
    expect(csv).toContain("Autorização de publicidade");
    expect(csv).toContain('"Ana";"5511999999999"');
    expect(csv).toContain('"22,50"');
  });
});
