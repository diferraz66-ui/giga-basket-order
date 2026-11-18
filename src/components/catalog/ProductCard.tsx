import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Product } from "@/data/catalog";
import { useCart } from "@/lib/cart";
import { formatBRL } from "@/lib/order";
import { ProductDetailsDialog } from "./ProductDetailsDialog";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const soldOut = product.status === "out_of_stock";

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
          className="h-full w-full object-contain p-3"
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
            Esgotado
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <button type="button" onClick={() => setDetailsOpen(true)} className="text-left">
          <h3 className="line-clamp-2 text-sm font-bold leading-tight hover:text-primary sm:text-base">
            {product.name}
          </h3>
        </button>
        <p className="line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
        <div className="mt-auto pt-2">
          <p className="font-display text-xl font-extrabold text-primary">
            {formatBRL(product.price)}
            <span className="ml-1 font-sans text-xs font-medium text-muted-foreground">/unidade</span>
          </p>
        </div>
        <Button
          variant="cta"
          size="sm"
          className="mt-2 h-auto min-h-10 w-full whitespace-normal px-2 py-2 text-[11px] leading-tight sm:text-xs"
          disabled={soldOut}
          onClick={() => {
            add({ id: product.id, name: product.name, price: product.price });
            toast.success(`${product.name} adicionado ao carrinho`);
          }}
        >
          <ShoppingCart className="hidden sm:block" />
          {soldOut ? "Produto esgotado" : "Adicionar ao carrinho"}
        </Button>
      </div>
      <ProductDetailsDialog product={product} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </article>
  );
}
