import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDateTime } from "@/lib/operations";

type Review = Tables<"product_reviews">;
type ProductInfo = Pick<Tables<"products">, "id" | "name">;
type ReviewFilter = "pendente" | "aprovado" | "recusado";

const filters: Array<{ value: ReviewFilter; label: string }> = [
  { value: "pendente", label: "Pendentes" },
  { value: "aprovado", label: "Aprovadas" },
  { value: "recusado", label: "Recusadas" },
];

export function ReviewsPanel() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [filter, setFilter] = useState<ReviewFilter>("pendente");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { data: productRows }] = await Promise.all([
      supabase.from("product_reviews").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id, name"),
    ]);
    if (error) toast.error("Não foi possível carregar as avaliações.");
    else setReviews(data ?? []);
    setProducts(productRows ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => reviews.filter((review) => review.status === filter), [filter, reviews]);

  async function moderate(review: Review, status: "aprovado" | "recusado") {
    setBusyId(review.id);
    const { error } = await supabase
      .from("product_reviews")
      .update({ status, moderated_at: new Date().toISOString() })
      .eq("id", review.id);
    setBusyId(null);
    if (error) {
      toast.error("Não foi possível atualizar esta avaliação.");
      return;
    }
    toast.success(status === "aprovado" ? "Avaliação publicada na vitrine." : "Avaliação recusada e ocultada.");
    await load();
  }

  const productName = (id: string) => products.find((product) => product.id === id)?.name ?? "Produto removido";

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{reviews.length} avaliação(ões) recebida(s)</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>Atualizar lista</Button>
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => (
          <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${filter === item.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {item.label} ({reviews.filter((review) => review.status === item.value).length})
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">Nenhuma avaliação nesta categoria.</p>
      ) : (
        <div className="space-y-3">
          {visible.map((review) => (
            <article key={review.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{productName(review.product_id)}</p>
                  <div className="mt-1 flex gap-0.5" aria-label={`${review.rating} de 5 estrelas`}>
                    {[1, 2, 3, 4, 5].map((star) => <span key={star} className={star <= review.rating ? "text-yellow-500" : "text-muted-foreground"}>★</span>)}
                  </div>
                  <p className="mt-1 text-sm font-semibold">{review.customer_name} · {review.city}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(review.created_at)}</p>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{review.status}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{review.comment}</p>
              {review.status === "pendente" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void moderate(review, "aprovado")} disabled={busyId === review.id}>
                    {busyId === review.id ? <Loader2 className="animate-spin" /> : <Check />} Aprovar e Publicar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void moderate(review, "recusado")} disabled={busyId === review.id}>
                    {busyId === review.id ? <Loader2 className="animate-spin" /> : <X />} Recusar / Excluir
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
