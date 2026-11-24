import { useState } from "react";
import { Ruler, ShoppingCart } from "lucide-react";
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
}: {
  product: Product;
  layout?: CatalogView;
}) {
  const { add, items, purchasedQuantities } = useCart();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const soldOut = product.status === "out_of_stock";
  const quantity =
    (items.find((item) => item.id === product.id)?.quantity ?? 0) +
    (purchasedQuantities[product.id] ?? 0);
  const limitReached = isProductLimitReached(quantity, product.maxPerCustomer);

  function addProduct() {
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
          <Button
            variant="cta"
            size="sm"
            className="mt-2 h-auto min-h-10 w-full whitespace-normal px-1 py-2 text-[10px] leading-tight sm:px-3 sm:text-xs"
            disabled={soldOut}
            onClick={addProduct}
          >
            <ShoppingCart className="hidden sm:block" />
            {soldOut ? (
              "Indisponível"
            ) : limitReached ? (
              "Limite atingido"
            ) : (
              <>
                <span className="sm:hidden">Adicionar</span>
                <span className="hidden sm:inline">Adicionar ao carrinho</span>
              </>
            )}
          </Button>
        </div>
        <ProductDetailsDialog product={product} open={detailsOpen} onOpenChange={setDetailsOpen} />
      </article>
    );
  }

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        className="relative block aspect-square w-full bg-card text-left"
        aria-label={`Ver detalhes e ampliar foto de ${product.name}`}
      >
        <img
          src={product.image}
          alt={product.name}
          width={816}
          height={816}
          loading="lazy"
          className="h-full w-full object-contain"
        />
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
        <Button
          variant="cta"
          size="sm"
          className="mt-2 h-auto min-h-10 w-full whitespace-normal px-2 py-2 text-[11px] leading-tight sm:text-xs"
          disabled={soldOut}
          onClick={addProduct}
        >
          <ShoppingCart className="hidden sm:block" />
          {soldOut
            ? "Indisponível"
            : limitReached
              ? "Limite atingido"
              : "Adicionar ao carrinho"}
        </Button>
      </div>
      <ProductDetailsDialog product={product} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </article>
  );
}
