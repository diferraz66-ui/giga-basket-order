import { useState } from "react";
import { CheckCircle2, Copy, Loader2, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { store, type Product } from "@/data/catalog";
import { RelatedSuggestionsDialog } from "./RelatedSuggestionsDialog";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import {
  buildOrderMessage,
  formatBRL,
  formatOrderNumber,
  minimumOrderProgress,
  whatsappLink,
  type CartItem,
} from "@/lib/order";
import { formatWhatsapp } from "@/lib/phone";
import {
  CheckoutAuthDialog,
  type CheckoutIdentity,
  type CheckoutResult,
} from "./CheckoutAuthDialog";

export function CartSheet({ products }: { products: Product[] }) {
  const {
    items,
    add,
    purchasedQuantities,
    total,
    open,
    setOpen,
    setQuantity,
    remove,
    clear,
    refreshPurchased,
  } = useCart();
  const { session, profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [done, setDone] = useState<{ number: number; link: string; message: string } | null>(null);
  const progress = minimumOrderProgress(total);

  const identity: CheckoutIdentity | null =
    session && profile
      ? {
          userId: session.user.id,
          fullName: profile.full_name,
          whatsapp: profile.whatsapp,
        }
      : null;

  function startCheckout() {
    if (!progress.reached) return;
    if (session && !profile) {
      toast.info("Aguarde enquanto carregamos seu cadastro.");
      return;
    }
    setSuggestionsOpen(true);
  }

  async function finalize({ identity: customer, delivery }: CheckoutResult) {
    if (items.length === 0 || !progress.reached) return;
    const customerWhatsapp = formatWhatsapp(customer.whatsapp);
    const popup = window.open("", "_blank");
    setBusy(true);
    const { data, error } = await supabase
      .from("orders")
      .insert({
        user_id: customer.userId,
        customer_name: customer.fullName,
        customer_whatsapp: customer.whatsapp,
        delivery_method: delivery.method,
        pickup_name: delivery.method === "pickup" ? delivery.pickupName : null,
        pickup_document: delivery.method === "pickup" ? delivery.pickupDocument : null,
        delivery_city: delivery.method === "van" ? delivery.deliveryCity : null,
        van_contact: delivery.method === "van" ? delivery.vanContact : null,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          subtotal: Math.round(item.price * item.quantity * 100) / 100,
        })),
        total,
      })
      .select("order_number, items")
      .single();
    setBusy(false);
    if (error || !data) {
      popup?.close();
      if (error?.message.includes("Limite maximo")) {
        toast.error("Um produto atingiu o limite por cliente ao somar seus pedidos anteriores.");
      } else if (error?.message.includes("pedido minimo")) {
        toast.error("O pedido mínimo para compras online é R$ 75,00.");
      } else {
        toast.error("Não foi possível registrar o pedido. Revise os dados e tente novamente.");
      }
      return;
    }
    const messageItems = Array.isArray(data.items)
      ? (data.items as unknown as CartItem[])
      : items;
    const message = buildOrderMessage({
      orderNumber: data.order_number,
      customerName: customer.fullName,
      customerWhatsapp,
      items: messageItems,
      delivery,
    });
    const link = whatsappLink(store.whatsapp, message);
    if (popup) popup.location.href = link;
    else toast.info("O navegador bloqueou a nova aba. Use o botão para abrir o WhatsApp.");
    await refreshPurchased();
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
    <>
      <Sheet
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            setDone(null);
            setCheckoutOpen(false);
          }
        }}
      >
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md [&>button]:text-ink-foreground">
          <SheetHeader className="bg-ink px-5 py-4 text-left">
            <SheetTitle className="flex items-center gap-2 font-display text-lg font-extrabold uppercase text-ink-foreground">
              <ShoppingCart className="size-5" /> Meu carrinho
            </SheetTitle>
          </SheetHeader>
          <div className="border-b border-primary/20 bg-primary/5 px-4 py-3 text-center text-xs font-semibold leading-relaxed text-foreground">
            💳 Pagamento somente via PIX
          </div>
          {done ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <CheckCircle2 className="size-14 text-whatsapp" />
              <div>
                <p className="text-sm text-muted-foreground">Pedido registrado</p>
                <p className="font-display text-3xl font-extrabold">
                  {formatOrderNumber(done.number)}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Envie a mensagem no WhatsApp para a loja confirmar seu pedido.
              </p>
              <Button variant="whatsapp" className="h-12 w-full" asChild>
                <a href={done.link} target="_blank" rel="noreferrer">
                  Abrir WhatsApp em nova aba
                </a>
              </Button>
              <Button variant="outline" className="h-12 w-full" onClick={() => void copySummary()}>
                <Copy /> Copiar Resumo do Pedido
              </Button>
              <Button
                variant="link"
                onClick={() => {
                  setDone(null);
                  setOpen(false);
                }}
              >
                Continuar comprando
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
              <ShoppingCart className="size-12 stroke-1" />
              <p>Seu carrinho está vazio.</p>
              <Button variant="link" onClick={() => setOpen(false)}>
                Ver produtos
              </Button>
            </div>
          ) : (
            <>
              <ul className="flex-1 divide-y divide-border overflow-y-auto px-5">
                {items.map((item) => {
                  const product = products.find((entry) => entry.id === item.id);
                  const limit = product?.maxPerCustomer ?? item.maxPerCustomer ?? 0;
                  const totalWithHistory = item.quantity + (purchasedQuantities[item.id] ?? 0);
                  const limitReached = isProductLimitReached(totalWithHistory, limit);
                  return (
                    <li key={item.id} className="flex gap-3 py-4">
                      {product && (
                        <img
                          src={product.image}
                          alt=""
                          className="size-20 shrink-0 rounded-xl border border-border object-contain p-1"
                          loading="lazy"
                        />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-bold leading-tight">
                            {item.name}
                          </p>
                          <button
                            aria-label={`Remover ${item.name}`}
                            onClick={() => remove(item.id)}
                            className="shrink-0 p-1 text-muted-foreground hover:text-primary"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatBRL(item.price)} por unidade
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center rounded-full border border-border">
                            <button
                              aria-label="Diminuir quantidade"
                              className="flex size-9 items-center justify-center hover:text-primary"
                              onClick={() => setQuantity(item.id, item.quantity - 1, limit)}
                            >
                              <Minus className="size-4" />
                            </button>
                            <span className="w-7 text-center text-sm font-bold">
                              {item.quantity}
                            </span>
                            <button
                              aria-label="Aumentar quantidade"
                              title={limitReached ? productLimitMessage(limit) : undefined}
                              className="flex size-9 items-center justify-center hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                              disabled={limitReached || item.quantity >= 99}
                              onClick={() => setQuantity(item.id, item.quantity + 1, limit)}
                            >
                              <Plus className="size-4" />
                            </button>
                          </div>
                          <span className="font-display font-extrabold">
                            {formatBRL(item.price * item.quantity)}
                          </span>
                        </div>
                        {limitReached && (
                          <p role="alert" className="mt-2 text-xs font-bold text-primary">
                            {productLimitMessage(limit)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="space-y-3 border-t border-border bg-muted px-5 py-5">
                <div
                  id="minimum-order-progress"
                  className={`rounded-xl p-3 ${progress.reached ? "bg-whatsapp/10" : "bg-card"}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold">
                    <span>Pedido mínimo: {formatBRL(75)}</span>
                    <span>{Math.round(progress.percent)}%</span>
                  </div>
                  <Progress
                    value={progress.percent}
                    aria-label="Progresso para atingir o pedido mínimo"
                    className={progress.reached ? "bg-whatsapp/20 [&>div]:!bg-whatsapp" : ""}
                  />
                  <p
                    className={`mt-2 text-xs font-bold leading-relaxed ${progress.reached ? "text-whatsapp" : "text-muted-foreground"}`}
                  >
                    {progress.reached
                      ? "✅ Pedido mínimo atingido! Você já pode finalizar sua compra."
                      : `Faltam ${formatBRL(progress.remaining)} — escolha mais ${progress.itemsRemaining} ${progress.itemsRemaining === 1 ? "item" : "itens"} para atingir o pedido mínimo!`}
                  </p>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold uppercase text-muted-foreground">Total</span>
                  <span className="font-display text-3xl font-extrabold text-primary">
                    {formatBRL(total)}
                  </span>
                </div>
                <Button
                  variant="cta"
                  className="h-13 w-full py-4 text-base"
                  onClick={startCheckout}
                  disabled={busy || !progress.reached}
                  aria-describedby="minimum-order-progress"
                >
                  {busy && <Loader2 className="animate-spin" />} Finalizar pedido
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Você será levado ao WhatsApp da loja com o pedido pronto.
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <RelatedSuggestionsDialog
        open={suggestionsOpen}
        onOpenChange={setSuggestionsOpen}
        products={products}
        cartItems={items}
        onAdd={(product) => add({ id: product.id, name: product.name, price: product.price, maxPerCustomer: product.maxPerCustomer })}
        onContinue={() => {
          setSuggestionsOpen(false);
          if (session && !profile) {
            toast.info("Aguarde enquanto carregamos seu cadastro.");
            return;
          }
          setCheckoutOpen(true);
        }}
      />
      <CheckoutAuthDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        identity={identity}
        onComplete={(result) => {
          setCheckoutOpen(false);
          void finalize(result);
        }}
      />
    </>
  );
}
