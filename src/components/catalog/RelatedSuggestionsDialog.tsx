import { useMemo } from "react";
import { ArrowRight, Plus, ShoppingBag } from "lucide-react";
import type { Product } from "@/data/catalog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/order";
import type { CartItem } from "@/lib/order";

export function RelatedSuggestionsDialog({
  open,
  onOpenChange,
  products,
  cartItems,
  onAdd,
  onContinue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  cartItems: CartItem[];
  onAdd: (product: Product) => boolean;
  onContinue: () => void;
}) {
  const suggestions = useMemo(() => {
    const selectedIds = new Set(cartItems.map((item) => item.id));
    const selectedCategories = new Set(
      cartItems
        .map((item) => products.find((product) => product.id === item.id)?.category)
        .filter((category): category is Product["category"] => Boolean(category)),
    );
    const available = products.filter((product) => product.status === "available" && !selectedIds.has(product.id));
    const sameCategory = available.filter((product) => selectedCategories.has(product.category));
    const complementary = available.filter((product) => !selectedCategories.has(product.category));
    return [...sameCategory, ...complementary].slice(0, 4);
  }, [cartItems, products]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <ShoppingBag className="size-5" />
            <span className="text-xs font-extrabold uppercase tracking-wide">Uma última olhadinha</span>
          </div>
          <DialogTitle className="font-display text-xl font-extrabold uppercase">
            Aproveite e leve também
          </DialogTitle>
          <DialogDescription>
            Sugestões relacionadas ao seu carrinho. Adicione o que quiser ou siga direto para a finalização.
          </DialogDescription>
        </DialogHeader>

        {suggestions.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {suggestions.map((product) => (
              <article key={product.id} className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-2.5">
                <div className="flex aspect-square items-center justify-center rounded-lg bg-white p-2">
                  <img src={product.image} alt={product.name} loading="lazy" className="max-h-full max-w-full object-contain" />
                </div>
                <p className="mt-2 line-clamp-2 min-h-9 text-xs font-bold">{product.name}</p>
                <p className="mt-1 font-display text-sm font-extrabold text-primary">{formatBRL(product.price)}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-9 w-full px-2 text-xs"
                  onClick={() => onAdd(product)}
                >
                  <Plus className="size-3.5" /> Adicionar
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
            Não encontramos outras sugestões disponíveis agora.
          </p>
        )}

        <DialogFooter className="mt-2">
          <Button variant="cta" className="h-12 w-full text-base" onClick={onContinue}>
            Continuar para Finalização <ArrowRight className="size-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
