import { useState } from "react";
import { Minus, Plus, Ruler, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Product } from "@/data/catalog";
import { useCart } from "@/lib/cart";
import { formatBRL, isProductLimitReached } from "@/lib/order";
import { ProductDetailsDialog } from "./ProductDetailsDialog";
import type { CatalogView } from "./CatalogViewToggle";

export function ProductCard({
  product,
  layout = "grid",
  reviewSummary,
  sequence,
}: {
  product: Product;
  layout?: CatalogView;
  reviewSummary?: { average: number; count: number } | undefined;
  sequence?: number | undefined;
}) {
  const { add, items, purchasedQuantities, setQuantity } = useCart();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const soldOut = product.status === "out_of_stock";
  const purchasedQuantity = purchasedQuantities[product.id] ?? 0;
  const cartQuantity = items.find((item) => item.id === product.id)?.quantity ?? 0;
  const quantity = cartQuantity + purchasedQuantity;
  const limitReached = isProductLimitReached(quantity, product.maxPerCustomer);\n\n  function decreaseProduct() {\n    setQuantity(product.id, cartQuantity - 1, product.maxPerCustomer);\n  }\n\n  function increaseProduct() {\n    const added = add({ id: product.id, name: product.name, price: product.price, maxPerCustomer: product.maxPerCustomer });\n    if (!added) return;\n  }

  function addProduct() {
    if (limitReached) return;
    const added = add({
      id: product.id,
      name: product.name,
      price: product.price,
      maxPerCustomer: product.maxPerCustomer,
    });
    if (added) toast.success(`${product.name} adicionado ao carrinho`);
  }

  if (layout === "list") {
    return (
      <article className="grid grid-cols-[80px_minmax(0,1fr)_104px] items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm sm:grid-cols-[144px_minmax(0,1fr)_180px] sm:gap-4">
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="relative block aspect-square w-full shrink-0 bg-white p-2 text-left"
          aria-label={`Ver detalhes e ampliar foto de ${product.name}`}
        >
          <img
            src={product.image}
            alt={product.name}
            width={416}
            height={416}
            loading="lazy"
            className="h-full w-full object-contain p-1"
          />
          {sequence !== undefined && <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">{String(sequence).padStart(2, "0")}</span>}
          {product.tags.includes("oferta") && (
            <span className="absolute left-0 top-0 rounded-md bg-primary px-1.5 py-1 font-display text-[9px] font-extrabold uppercase text-primary-foreground">
              Oferta
            </span>
          )}
          {soldOut && (
            <span className="absolute inset-x-0 bottom-0 rounded-md bg-ink px-1 py-1 text-center font-display text-[9px] font-extrabold uppercase text-ink-foreground">
              Indisponível
            </span>
          )}
        </button>
        <div className="min-w-0">
          <button type="button" onClick={() => setDetailsOpen(true)} className="text-left">
            <h3 className="line-clamp-2 text-sm font-bold leading-tight hover:text-primary sm:text-lg">
              {product.name}
            </h3>
          </button>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
            {product.description}
          </p>
          {reviewSummary && reviewSummary.count > 0 && (
            <p className="mt-1 text-xs font-bold text-yellow-600">⭐ {reviewSummary.average.toFixed(1)} ({reviewSummary.count})</p>
          )}
          <p
            className="mt-1 flex items-center gap-1 truncate text-[10px] text-muted-foreground sm:text-xs"
            title={product.dimensions || "Consulte o vendedor"}
          >
            <Ruler className="size-3 shrink-0" />{" "}
            {product.dimensions || "Dimensões: consulte o vendedor"}
          </p>
          {product.maxPerCustomer > 0 && (
            <p className="mt-1 line-clamp-2 text-[10px] font-bold text-muted-foreground sm:text-xs">
              Limite: até {product.maxPerCustomer} un. por cliente
            </p>
          )}
        </div>
        <div className="min-w-0 text-right">
          <p className="font-display text-base font-extrabold text-primary sm:text-2xl">
            {formatBRL(product.price)}
          </p>
          <p className="text-[9px] text-muted-foreground sm:text-xs">/unidade</p>
          {cartQuantity > 0 ? (
            <div className="mt-2 flex h-10 items-center justify-between rounded-full border border-primary/30 bg-primary/5 px-1">
              <button type="button" aria-label={`Diminuir ${product.name}`} className="flex size-8 items-center justify-center rounded-full hover:bg-primary/10" onClick={decreaseProduct}>
                <Minus className="size-4" />
              </button>
              <span aria-live="polite" className="min-w-6 text-center text-sm font-extrabold">{cartQuantity}</span>
              <button type="button" aria-label={`Aumentar ${product.name}`} title={limitReached ? "Limite por cliente atingido" : undefined} disabled={soldOut || limitReached || cartQuantity >= 99} className="flex size-8 items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-40" onClick={increaseProduct}>
                <Plus className="size-4" />
              </button>
            </div>
          ) : (
            <Button
              variant="cta"
              size="sm"
              className="mt-2 h-auto min-h-10 w-full whitespace-normal px-1 py-2 text-[10px] leading-tight sm:px-3 sm:text-xs"
              disabled={soldOut || limitReached}
              onClick={addProduct}
            >
              <ShoppingCart className="hidden sm:block" />
              {soldOut ? "Indisponível" : limitReached ? "Limite atingido" : <>
                <span className="sm:hidden">Adicionar</span>
                <span className="hidden sm:inline">Adicionar ao carrinho</span>
              </>}
            </Button>
          )}
        </div>
        <ProductDetailsDialog product={product} reviewSummary={reviewSummary} open={detailsOpen} onOpenChange={setDetailsOpen} />
      </article>
    );
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        className="relative flex h-40 w-full items-center justify-center overflow-hidden bg-white p-2 text-left sm:h-44"
        aria-label={`Ver detalhes e ampliar foto de ${product.name}`}
      >
        <img
          src={product.image}
          alt={product.name}
          width={816}
          height={816}
          loading="lazy"
          className="max-h-full max-w-full object-contain"
        />
        {sequence !== undefined && <span className="absolute bottom-2 right-2 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white">{String(sequence).padStart(2, "0")}</span>}
        {product.tags.includes("oferta") && (
          <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-1 font-display text-[10px] font-extrabold uppercase text-primary-foreground">
            Oferta
          </span>
        )}
        {product.tags.includes("novidade") && (
          <span className="absolute right-2 top-2 rounded-md bg-ink px-2 py-1 font-display text-[10px] font-bold uppercase text-ink-foreground">
            Novo
          </span>
        )}
        {soldOut && (
          <span className="absolute inset-x-3 bottom-3 rounded-md bg-ink px-2 py-2 text-center font-display text-xs font-extrabold uppercase text-ink-foreground">
            Indisponível
          </span>
        )}
      </button>
      <div className="flex h-full flex-1 flex-col justify-between gap-1 p-3">
        <button type="button" onClick={() => setDetailsOpen(true)} className="text-left">
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-bold leading-tight hover:text-primary sm:text-base">
            {product.name}
          </h3>
        </button>
        <p className="line-clamp-2 min-h-[2rem] text-xs text-gray-500">{product.description}</p>
        {reviewSummary && reviewSummary.count > 0 && (
          <p className="text-xs font-bold text-yellow-600">⭐ {reviewSummary.average.toFixed(1)} ({reviewSummary.count})</p>
        )}
        <p
          className="flex items-center gap-1 truncate text-[10px] text-muted-foreground"
          title={product.dimensions || "Consulte o vendedor"}
        >
          <Ruler className="size-3 shrink-0" />{" "}
          {product.dimensions || "Dimensões: consulte o vendedor"}
        </p>
        {product.maxPerCustomer > 0 && (
          <p className="mt-1 w-fit rounded-md bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">
            Limite: até {product.maxPerCustomer} un. por cliente
          </p>
        )}
        <div className="mt-auto min-h-[3.5rem] pt-2">
          <p className="font-display text-xl font-extrabold text-primary">
            {formatBRL(product.price)}
            <span className="ml-1 font-sans text-xs font-medium text-muted-foreground">
              /unidade
            </span>
          </p>
        </div>
        {cartQuantity > 0 ? (
          <div className="mt-2 flex h-10 items-center justify-between rounded-full border border-primary/30 bg-primary/5 px-1">
            <button type="button" aria-label={`Diminuir ${product.name}`} className="flex size-8 items-center justify-center rounded-full hover:bg-primary/10" onClick={decreaseProduct}>
              <Minus className="size-4" />
            </button>
            <span aria-live="polite" className="min-w-6 text-center text-sm font-extrabold">{cartQuantity}</span>
            <button type="button" aria-label={`Aumentar ${product.name}`} title={limitReached ? "Limite por cliente atingido" : undefined} disabled={soldOut || limitReached || cartQuantity >= 99} className="flex size-8 items-center justify-center rounded-full hover:bg-primary/10 disabled:opacity-40" onClick={increaseProduct}>
              <Plus className="size-4" />
            </button>
          </div>
        ) : (
          <Button
            variant="cta"
            size="sm"
            className="mt-2 h-auto min-h-10 w-full whitespace-normal px-2 py-2 text-[11px] leading-tight sm:text-xs"
            disabled={soldOut || limitReached}
            onClick={addProduct}
          >
            <ShoppingCart className="hidden sm:block" />
            {soldOut ? "Indisponível" : limitReached ? "Limite atingido" : "Adicionar ao carrinho"}
          </Button>
        )}
      </div>
      <ProductDetailsDialog product={product} reviewSummary={reviewSummary} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </article>
  );
}
