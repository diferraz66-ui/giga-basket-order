import { useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type ExistingReview = { id: string; status: string };

export function ProductReviewForm({
  productId,
  productName,
  orderId,
  active = true,
}: {
  productId: string;
  productName: string;
  orderId?: string;
  active?: boolean;
}) {
  const { session, profile } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState(5);
  const [name, setName] = useState(profile?.full_name ?? "");
  const [city, setCity] = useState("");
  const [comment, setComment] = useState("");
  const [eligibleOrderId, setEligibleOrderId] = useState<string | null>(orderId ?? null);
  const [existing, setExisting] = useState<ExistingReview | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile?.full_name && !name) setName(profile.full_name);
  }, [profile?.full_name, name]);

  useEffect(() => {
    let current = true;
    async function checkEligibility() {
      if (!active || !session?.user.id) {
        setEligibleOrderId(null);
        setExisting(null);
        return;
      }
      setChecking(true);
      const previousQuery = supabase
        .from("product_reviews")
        .select("id, status")
        .eq("product_id", productId)
        .eq("user_id", session.user.id);
      const { data: previous } = orderId
        ? await previousQuery.eq("order_id", orderId).maybeSingle()
        : await previousQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!current) return;
      if (previous) {
        setExisting(previous);
        setEligibleOrderId(orderId ?? null);
        setChecking(false);
        return;
      }
      if (orderId) {
        setEligibleOrderId(orderId);
        setChecking(false);
        return;
      }
      const { data: completedOrders } = await supabase
        .from("orders")
        .select("id, items")
        .eq("user_id", session.user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      if (!current) return;
      const eligible = (completedOrders ?? []).find((order) =>
        Array.isArray(order.items) &&
        (order.items as Array<{ id?: string }>).some((item) => item?.id === productId),
      );
      setEligibleOrderId(eligible?.id ?? null);
      setChecking(false);
    }
    void checkEligibility();
    return () => { current = false; };
  }, [active, orderId, productId, session?.user.id]);

  async function submit() {
    if (!session?.user.id) return toast.error("Entre em Meus Pedidos para enviar sua avaliação.");
    if (!eligibleOrderId) return toast.error("Este produto ainda não possui uma compra concluída vinculada à sua conta.");
    if (name.trim().length < 2 || city.trim().length < 2 || !comment.trim()) {
      return toast.error("Preencha seu nome, cidade e comentário.");
    }
    setSubmitting(true);
    const { error } = await supabase.from("product_reviews").insert({
      product_id: productId,
      order_id: eligibleOrderId,
      user_id: session.user.id,
      customer_name: name.trim(),
      city: city.trim(),
      rating,
      comment: comment.trim(),
      status: "pendente",
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.code === "23505"
        ? "Você já enviou uma avaliação para este produto neste pedido."
        : "Não foi possível enviar sua avaliação. Tente novamente.");
      return;
    }
    setExisting({ id: "sent", status: "pendente" });
    setExpanded(false);
    toast.success("Obrigado! Sua avaliação foi enviada e será publicada após validação da loja.");
  }

  return (
    <section className="mt-5 rounded-xl border border-border bg-muted/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-extrabold uppercase">Avalie este produto</h3>
          <p className="text-xs text-muted-foreground">{productName}</p>
        </div>
        {existing ? (
          <span className="rounded-full bg-background px-3 py-2 text-xs font-bold text-muted-foreground">
            {existing.status === "aprovado" ? "Avaliação publicada" : existing.status === "recusado" ? "Avaliação recusada" : "Avaliação em análise"}
          </span>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Fechar avaliação" : "Avaliar este produto"}
          </Button>
        )}
      </div>
      {expanded && !existing && (
        <div className="mt-4 space-y-3">
          {!session ? (
            <p className="text-sm text-muted-foreground">
              Entre na sua conta pela opção Meus Pedidos para avaliar um produto comprado.
            </p>
          ) : checking ? (
            <div className="flex justify-center py-3"><Loader2 className="size-5 animate-spin" /></div>
          ) : !eligibleOrderId ? (
            <p className="text-sm text-muted-foreground">
              A avaliação fica disponível após a conclusão de uma compra deste produto.
            </p>
          ) : (
            <>
              <div>
                <Label>Nota</Label>
                <div className="mt-1 flex gap-1" role="group" aria-label="Escolha uma nota de 1 a 5 estrelas">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button key={value} type="button" onClick={() => setRating(value)} aria-label={`${value} estrela(s)`} aria-pressed={rating === value} className="rounded p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                      <Star className={`size-7 ${value <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label htmlFor={`review-name-${productId}`}>Seu Nome</Label><Input id={`review-name-${productId}`} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Como podemos chamar você?" /></div>
                <div className="space-y-1"><Label htmlFor={`review-city-${productId}`}>Cidade</Label><Input id={`review-city-${productId}`} value={city} onChange={(event) => setCity(event.target.value)} maxLength={100} placeholder="Ex: Santo Antônio de Jesus - BA" /></div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between"><Label htmlFor={`review-comment-${productId}`}>Seu Comentário</Label><span className="text-xs text-muted-foreground">{comment.length}/250</span></div>
                <Textarea id={`review-comment-${productId}`} value={comment} onChange={(event) => setComment(event.target.value.slice(0, 250))} maxLength={250} rows={3} placeholder="Conte como foi sua experiência com o produto..." />
              </div>
              <Button type="button" className="w-full" onClick={() => void submit()} disabled={submitting || checking}>
                {submitting && <Loader2 className="size-4 animate-spin" />} Enviar avaliação
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
