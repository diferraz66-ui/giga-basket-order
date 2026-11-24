import type { Tables } from "@/integrations/supabase/types";
import type { Order } from "@/lib/operations";

export type CustomerFilter = "all" | "buyers" | "never" | "opted_in" | "not_opted_in" | "recurring";

export type CustomerSummary = Tables<"profiles"> & {
  completedOrders: number;
  totalSpent: number;
};

export function summarizeCustomers(profiles: Tables<"profiles">[], orders: Order[]): CustomerSummary[] {
  return profiles.map((profile) => {
    const purchases = orders.filter((order) => order.user_id === profile.id && order.status === "completed");
    return {
      ...profile,
      completedOrders: purchases.length,
      totalSpent: purchases.reduce((sum, order) => sum + Number(order.total), 0),
    };
  });
}

export function filterCustomers(customers: CustomerSummary[], filter: CustomerFilter) {
  switch (filter) {
    case "buyers":
      return customers.filter((customer) => customer.completedOrders > 0);
    case "never":
      return customers.filter((customer) => customer.completedOrders === 0);
    case "opted_in":
      return customers.filter((customer) => customer.marketing_opt_in);
    case "not_opted_in":
      return customers.filter((customer) => !customer.marketing_opt_in);
    case "recurring":
      return customers.filter((customer) => customer.completedOrders >= 2);
    default:
      return customers;
  }
}

function csvCell(value: string | number | boolean | null) {
  let text = value === null ? "" : String(value);
  // evita que planilhas executem formulas vindas de dados digitados por clientes
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function customersToCsv(customers: CustomerSummary[]) {
  const rows = [
    ["Nome", "WhatsApp", "Data de cadastro", "Total gasto", "Pedidos concluídos", "Autorização de publicidade", "Data/hora da autorização"],
    ...customers.map((customer) => [
      customer.full_name,
      customer.whatsapp,
      customer.created_at,
      customer.totalSpent.toFixed(2).replace(".", ","),
      customer.completedOrders,
      customer.marketing_opt_in ? "Sim" : "Não",
      customer.marketing_opt_in_at,
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}
