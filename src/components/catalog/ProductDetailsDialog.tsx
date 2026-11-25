import { useEffect, useRef, useState } from "react";
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
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    mode: "idle" | "pan" | "pinch";
    startDistance: number;
    startZoom: number;
    startMidpoint: { x: number; y: number };
    startScroll: { left: number; top: number };
    lastPoint: { x: number; y: number };
    moved: boolean;
  }>({
    mode: "idle",
    startDistance: 0,
    startZoom: 1,
    startMidpoint: { x: 0, y: 0 },
    startScroll: { left: 0, top: 0 },
    lastPoint: { x: 0, y: 0 },
    moved: false,
  });
  const suppressImageClick = useRef(false);
  const lastTap = useRef(0);
  const lastTapPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (open) {
      setZoom(1);
      pointers.current.clear();
      gesture.current.mode = "idle";
      if (imageViewport.current) {
        imageViewport.current.scrollLeft = 0;
        imageViewport.current.scrollTop = 0;
      }
    }
  }, [product.id, open]);

  function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function applyTapZoom(clientX: number, clientY: number) {
    const viewport = imageViewport.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const nextZoom = zoom >= 1.9 ? 1 : 2;
    const relativeX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const relativeY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const normalizedX = rect.width ? relativeX / rect.width : 0.5;
    const normalizedY = rect.height ? relativeY / rect.height : 0.5;
    setZoom(nextZoom);
    requestAnimationFrame(() => {
      const current = imageViewport.current;
      if (!current) return;
      current.scrollLeft = Math.max(0, normalizedX * current.scrollWidth - relativeX);
      current.scrollTop = Math.max(0, normalizedY * current.scrollHeight - relativeY);
    });
  }
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
              style={{ touchAction: zoom > 1 ? "none" : "pan-y" }}
              onPointerDown={(event) => {
                const viewport = imageViewport.current;
                if (!viewport) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                const point = { x: event.clientX, y: event.clientY };
                pointers.current.set(event.pointerId, point);
                suppressImageClick.current = false;

                if (pointers.current.size >= 2) {
                  const [first, second] = [...pointers.current.values()];
                  if (!first || !second) return;
                  const center = midpoint(first, second);
                  gesture.current = {
                    ...gesture.current,
                    mode: "pinch",
                    startDistance: Math.max(1, distance(first, second)),
                    startZoom: zoom,
                    startMidpoint: center,
                    startScroll: { left: viewport.scrollLeft, top: viewport.scrollTop },
                    lastPoint: point,
                    moved: false,
                  };
                } else if (zoom > 1) {
                  gesture.current = {
                    ...gesture.current,
                    mode: "pan",
                    startDistance: 0,
                    startZoom: zoom,
                    startMidpoint: point,
                    startScroll: { left: viewport.scrollLeft, top: viewport.scrollTop },
                    lastPoint: point,
                    moved: false,
                  };
                } else {
                  gesture.current = { ...gesture.current, mode: "idle", lastPoint: point, moved: false };
                }
              }}
              onPointerMove={(event) => {
                const viewport = imageViewport.current;
                if (!viewport || !pointers.current.has(event.pointerId)) return;
                const point = { x: event.clientX, y: event.clientY };
                pointers.current.set(event.pointerId, point);

                if (pointers.current.size >= 2) {
                  const [first, second] = [...pointers.current.values()];
                  if (!first || !second) return;
                  const center = midpoint(first, second);
                  const nextZoom = Math.max(1, Math.min(3, gesture.current.startZoom * (distance(first, second) / Math.max(1, gesture.current.startDistance))));
                  const rect = viewport.getBoundingClientRect();
                  const localX = center.x - rect.left;
                  const localY = center.y - rect.top;
                  const scaleRatio = nextZoom / Math.max(1, gesture.current.startZoom);
                  viewport.scrollLeft = Math.max(0, (gesture.current.startScroll.left + gesture.current.startMidpoint.x - rect.left) * scaleRatio - localX);
                  viewport.scrollTop = Math.max(0, (gesture.current.startScroll.top + gesture.current.startMidpoint.y - rect.top) * scaleRatio - localY);
                  if (Math.abs(nextZoom - zoom) > 0.01) setZoom(nextZoom);
                  gesture.current.moved = true;
                  suppressImageClick.current = true;
                  return;
                }

                if (gesture.current.mode === "pan" && zoom > 1) {
                  const dx = point.x - gesture.current.lastPoint.x;
                  const dy = point.y - gesture.current.lastPoint.y;
                  if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                    viewport.scrollLeft -= dx;
                    viewport.scrollTop -= dy;
                    gesture.current.moved = true;
                    suppressImageClick.current = true;
                  }
                  gesture.current.lastPoint = point;
                }
              }}
              onPointerUp={(event) => {
                pointers.current.delete(event.pointerId);
                if (pointers.current.size === 1 && zoom > 1) {
                  const remaining = [...pointers.current.values()][0];
                  if (!remaining) return;
                  gesture.current.mode = "pan";
                  gesture.current.lastPoint = remaining;
                  const viewport = imageViewport.current;
                  if (viewport) gesture.current.startScroll = { left: viewport.scrollLeft, top: viewport.scrollTop };
                } else if (pointers.current.size === 0) {
                  gesture.current.mode = "idle";
                }
              }}
              onPointerCancel={(event) => {
                pointers.current.delete(event.pointerId);
                gesture.current.mode = pointers.current.size ? "pan" : "idle";
              }}
              onClick={(event) => {
                if (suppressImageClick.current) {
                  suppressImageClick.current = false;
                  return;
                }
                const now = Date.now();
                const previous = lastTap.current;
                const previousPoint = lastTapPoint.current;
                const isDoubleTap = now - previous < 320 && previousPoint !== null &&
                  distance(previousPoint, { x: event.clientX, y: event.clientY }) < 32;
                lastTap.current = now;
                lastTapPoint.current = { x: event.clientX, y: event.clientY };
                if (isDoubleTap || zoom > 1) {
                  applyTapZoom(event.clientX, event.clientY);
                  lastTap.current = 0;
                  lastTapPoint.current = null;
                } else {
                  applyTapZoom(event.clientX, event.clientY);
                }
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
                disabled={zoom >= 3}
                onClick={() => setZoom((value) => Math.min(3, value + 0.5))}
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
