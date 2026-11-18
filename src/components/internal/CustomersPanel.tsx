import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/order";
import { formatDateTime, parseOrder, type Order } from "@/lib/operations";
import { customersToCsv, filterCustomers, summarizeCustomers, type CustomerFilter, type CustomerSummary } from "@/lib/customers";
import { formatWhatsapp } from "@/lib/phone";

const filters: Array<{ id: CustomerFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "buyers", label: "Já compraram" },
  { id: "never", label: "Nunca compraram" },
  { id: "opted_in", label: "Autorizaram publicidade" },
  { id: "not_opted_in", label: "Não autorizaram publicidade" },
  { id: "recurring", label: "Recorrentes" },
];

export function CustomersPanel() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: profiles, error: profilesError }, { data: orderRows, error: ordersError }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("*"),
    ]);
    if (profilesError || ordersError) toast.error("Não foi possível carregar os clientes");
    else {
      const orders: Order[] = (orderRows ?? []).map(parseOrder);
      setCustomers(summarizeCustomers(profiles ?? [], orders));
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => filterCustomers(customers, filter), [customers, filter]);

  function exportCsv() {
    const blob = new Blob([customersToCsv(visible)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `clientes-giga-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{visible.length} de {customers.length} clientes</p>
        <Button variant="outline" onClick={exportCsv} disabled={visible.length === 0}><Download /> Exportar Excel (.CSV)</Button>
      </div>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => <button key={item.id} onClick={() => setFilter(item.id)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${filter === item.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{item.label}</button>)}
      </div>
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div> : (
        <div className="rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Cadastro</TableHead><TableHead>Total gasto</TableHead><TableHead>Publicidade</TableHead></TableRow></TableHeader>
            <TableBody>
              {visible.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell><p className="font-bold">{customer.full_name}</p><p className="text-xs text-muted-foreground">{formatWhatsapp(customer.whatsapp)}</p><p className="text-xs text-muted-foreground">{customer.completedOrders} compra(s) concluída(s)</p></TableCell>
                  <TableCell className="whitespace-nowrap text-xs">{formatDateTime(customer.created_at)}</TableCell>
                  <TableCell className="whitespace-nowrap font-bold">{formatBRL(customer.totalSpent)}</TableCell>
                  <TableCell><p className="font-bold">{customer.marketing_opt_in ? "Sim" : "Não"}</p>{customer.marketing_opt_in_at && <p className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(customer.marketing_opt_in_at)}</p>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {visible.length === 0 && <p className="py-12 text-center text-muted-foreground">Nenhum cliente neste filtro.</p>}
        </div>
      )}
    </section>
  );
}
