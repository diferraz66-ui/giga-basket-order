import { useState } from "react";
import { CheckCircle2, Copy, Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { products, store } from "@/data/catalog";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { buildOrderMessage, formatBRL, formatOrderNumber, whatsappLink } from "@/lib/order";
import { formatWhatsapp } from "@/lib/phone";

export function CartSheet() {
  const { items, total, open, setOpen, setQuantity, remove, clear } = useCart();
  const { session, profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ number: number; link: string; message: string } | null>(null);

  async function finalize() {
    if (!session || items.length === 0) return;
    const customerName = profile?.full_name ?? "Cliente";
    const customerWhatsapp = profile ? formatWhatsapp(profile.whatsapp) : "";
    const popup = window.open("", "_blank");
    setBusy(true);
    const { data, error } = await supabase.from("orders").insert({
      user_id: session.user.id,
      customer_name: customerName,
      customer_whatsapp: profile?.whatsapp ?? "",
      items: items.map((item) => ({ ...item, subtotal: Math.round(item.price * item.quantity * 100) / 100 })),
      total,
    }).select("order_number").single();
    setBusy(false);
    if (error || !data) {
      popup?.close();
      toast.error("Não foi possível registrar o pedido. Tente novamente.");
      return;
    }
    const message = buildOrderMessage({ orderNumber: data.order_number, customerName, customerWhatsapp, items });
    const link = whatsappLink(store.whatsapp, message);
    if (popup) popup.location.href = link;
    else toast.info("O navegador bloqueou a nova aba. Use o botão para abrir o WhatsApp.");
    clear();
    setDone({ number: data.order_number, link, message });
  }

  async function copySummary() {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(done.message);
      toast.success("Resumo do pedido copiado");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = done.message;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      toast.success("Resumo do pedido copiado");
    }
  }

  return (
    <Sheet open={open} onOpenChange={(value) => { setOpen(value); if (!value) setDone(null); }}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md [&>button]:text-ink-foreground">
        <SheetHeader className="bg-ink px-5 py-4 text-left"><SheetTitle className="flex items-center gap-2 font-display text-lg font-extrabold uppercase text-ink-foreground"><ShoppingCart className="size-5" /> Meu carrinho</SheetTitle></SheetHeader>
        {done ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <CheckCircle2 className="size-14 text-whatsapp" />
            <div><p className="text-sm text-muted-foreground">Pedido registrado</p><p className="font-display text-3xl font-extrabold">{formatOrderNumber(done.number)}</p></div>
            <p className="text-sm text-muted-foreground">Envie a mensagem no WhatsApp para a loja confirmar seu pedido.</p>
            <Button variant="whatsapp" className="h-12 w-full" asChild><a href={done.link} target="_blank" rel="noreferrer">Abrir WhatsApp em nova aba</a></Button>
            <Button variant="outline" className="h-12 w-full" onClick={() => void copySummary()}><Copy /> Copiar Resumo do Pedido</Button>
            <Button variant="link" onClick={() => { setDone(null); setOpen(false); }}>Continuar comprando</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground"><ShoppingCart className="size-12 stroke-1" /><p>Seu carrinho está vazio.</p><Button variant="link" onClick={() => setOpen(false)}>Ver produtos</Button></div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-border overflow-y-auto px-5">
              {items.map((item) => {
                const product = products.find((entry) => entry.id === item.id);
                return <li key={item.id} className="flex gap-3 py-4">
                  {product && <img src={product.image} alt="" className="size-20 shrink-0 rounded-xl border border-border object-contain p-1" loading="lazy" />}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-bold leading-tight">{item.name}</p><button aria-label={`Remover ${item.name}`} onClick={() => remove(item.id)} className="shrink-0 p-1 text-muted-foreground hover:text-primary"><Trash2 className="size-4" /></button></div>
                    <p className="text-xs text-muted-foreground">{formatBRL(item.price)} por unidade</p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center rounded-full border border-border">
                        <button aria-label="Diminuir quantidade" className="flex size-9 items-center justify-center hover:text-primary" onClick={() => setQuantity(item.id, item.quantity - 1)}><Minus className="size-4" /></button>
                        <span className="w-7 text-center text-sm font-bold">{item.quantity}</span>
                        <button aria-label="Aumentar quantidade" className="flex size-9 items-center justify-center hover:text-primary" onClick={() => setQuantity(item.id, item.quantity + 1)}><Plus className="size-4" /></button>
                      </div>
                      <span className="font-display font-extrabold">{formatBRL(item.price * item.quantity)}</span>
                    </div>
                  </div>
                </li>;
              })}
            </ul>
            <div className="space-y-3 border-t border-border bg-muted px-5 py-5">
              <div className="flex items-baseline justify-between"><span className="text-sm font-bold uppercase text-muted-foreground">Total</span><span className="font-display text-3xl font-extrabold text-primary">{formatBRL(total)}</span></div>
              <Button variant="cta" className="h-13 w-full py-4 text-base" onClick={finalize} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Finalizar pedido</Button>
              <p className="text-center text-xs text-muted-foreground">Você será levado ao WhatsApp da loja com o pedido pronto.</p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
