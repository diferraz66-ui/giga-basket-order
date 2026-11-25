import { useRef, useState } from "react";
import { Minus, Plus, Ruler, ShoppingCart, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProductReviewForm } from "./ProductReviewForm";
import type { Product } from "@/data/catalog";
import { useCart } from "@/lib/cart";
import { formatBRL, isProductLimitReached, productLimitMessage } from "@/lib/order";

export function ProductDetailsDialog({
  product,
  open,
  onOpenChange,
  reviewSummary,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewSummary?: { average: number; count: number } | undefined;
}) {
  const { add, setQuantity, items, purchasedQuantities } = useCart();
  const [zoom, setZoom] = useState(1);
  const imageViewport = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressImageClick = useRef(false);
  const soldOut = product.status === "out_of_stock";
  const cartQuantity = items.find((item) => item.id === product.id)?.quantity ?? 0;
  const totalQuantity = cartQuantity + (purchasedQuantities[product.id] ?? 0);
  const limitReached = isProductLimitReached(totalQuantity, product.maxPerCustomer);

  function addProduct() {
    if (soldOut) return;
    const added = add({
      id: product.id,
      name: product.name,
      price: product.price,
      maxPerCustomer: product.maxPerCustomer,
    });
    if (added) toast.success(`${product.name} adicionado ao carrinho`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setZoom(1);
        onOpenChange(value);
      }}
    >
      <DialogContent className="mx-auto w-[92vw] max-w-md max-h-[82vh] overflow-y-auto rounded-2xl p-4 gap-3 sm:w-full sm:max-w-3xl sm:max-h-[90vh] sm:gap-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div
              ref={imageViewport}
              className={`relative h-48 overflow-auto rounded-2xl border border-border bg-card sm:h-64 ${zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
              style={{ touchAction: "none" }}
              onPointerDown={(event) => {
                const viewport = imageViewport.current;
                if (!viewport || zoom <= 1) return;
                dragState.current = {
                  x: event.clientX,
                  y: event.clientY,
                  left: viewport.scrollLeft,
                  top: viewport.scrollTop,
                  moved: false,
                };
                viewport.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const viewport = imageViewport.current;
                const drag = dragState.current;
                if (!viewport || !drag) return;
                const dx = event.clientX - drag.x;
                const dy = event.clientY - drag.y;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                  drag.moved = true;
                  suppressImageClick.current = true;
                }
                viewport.scrollLeft = drag.left - dx;
                viewport.scrollTop = drag.top - dy;
              }}
              onPointerUp={() => {
                dragState.current = null;
              }}
              onPointerCancel={() => {
                dragState.current = null;
              }}
              onClick={() => {
                if (suppressImageClick.current) {
                  suppressImageClick.current = false;
                  return;
                }
                setZoom((value) => (value >= 2.5 ? 1 : Math.min(2.5, value + 0.5)));
              }}
            >
              <img
                src={product.image}
                alt={product.name}
                draggable={false}
                className="block h-full object-contain p-2"
                style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
              />
            </div>
            <div
              className="mt-1 flex items-center justify-center gap-2"
              aria-label="Controles de zoom"
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Diminuir zoom"
                disabled={zoom <= 1}
                onClick={() => setZoom((value) => Math.max(1, value - 0.5))}
              >
                <Minus />
              </Button>
              <span className="flex min-w-24 items-center justify-center gap-1 text-xs font-bold text-muted-foreground">
                <ZoomIn className="size-4" /> {Math.round(zoom * 100)}%
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Aumentar zoom"
                disabled={zoom >= 2.5}
                onClick={() => setZoom((value) => Math.min(2.5, value + 0.5))}
              >
                <Plus />
              </Button>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <DialogHeader>
              <DialogTitle className="pr-8 font-display text-xl font-extrabold uppercase leading-tight sm:text-2xl">
                {product.name}
              </DialogTitle>
              <DialogDescription className="pt-1 text-left text-sm leading-snug">
                {product.description}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex gap-2 rounded-xl bg-muted p-3 text-sm">
              <Ruler className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-bold">Tamanho / Dimensões</p>
                <p className="mt-1 text-muted-foreground">
                  {product.dimensions || "Consulte o vendedor."}
                </p>
              </div>
            </div>
            {product.maxPerCustomer > 0 && (
              <p className="mt-1 w-fit rounded-md bg-muted px-2 py-1 text-xs font-bold text-muted-foreground">
                Limite: até {product.maxPerCustomer} un. por cliente
              </p>
            )}
            <p className="mt-2 font-display text-2xl font-extrabold text-primary sm:text-3xl">
              {formatBRL(product.price)}
              <span className="ml-1 font-sans text-sm font-medium text-muted-foreground">
                /unidade
              </span>
            </p>
            {soldOut && (
              <p className="mt-2 text-sm font-bold text-destructive">
                Produto esgotado no momento.
              </p>
            )}
            {cartQuantity > 0 ? (
              <div className="mt-2">
                <div className="flex h-12 w-full items-center justify-between rounded-md bg-primary px-2 text-primary-foreground">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Retirar uma unidade de ${product.name}`}
                    className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                    onClick={() =>
                      setQuantity(product.id, cartQuantity - 1, product.maxPerCustomer)
                    }
                  >
                    <Minus />
                  </Button>
                  <span
                    className="font-display text-lg font-extrabold"
                    aria-live="polite"
                    aria-label={`${cartQuantity} unidades no carrinho`}
                  >
                    {cartQuantity}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Adicionar mais uma unidade de ${product.name}`}
                    className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                    disabled={soldOut || limitReached}
                    onClick={addProduct}
                  >
                    <Plus />
                  </Button>
                </div>
                {limitReached && (
                  <p className="mt-2 text-center text-xs font-bold text-muted-foreground">
                    {productLimitMessage(product.maxPerCustomer)}
                  </p>
                )}
              </div>
            ) : (
              <Button
                variant="cta"
                className="mt-2 h-11 w-full"
                onClick={addProduct}
                disabled={soldOut}
              >
                <ShoppingCart />{" "}
                {soldOut
                  ? "Produto esgotado"
                  : limitReached
                    ? "Limite atingido"
                    : "Adicionar ao carrinho"}
              </Button>
            )}
          </div>
        </div>
        {reviewSummary && reviewSummary.count > 0 && (
          <p className="mt-4 flex items-center gap-2 text-sm font-bold text-yellow-600">
            ⭐ {reviewSummary.average.toFixed(1)} de 5 ({reviewSummary.count} avaliações)
          </p>
        )}
        <ProductReviewForm productId={product.id} productName={product.name} active={open} />
      </DialogContent>
    </Dialog>
  );
}
