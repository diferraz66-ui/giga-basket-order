import { useState } from "react";
import { Minus, Plus, Ruler, ShoppingCart, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Product } from "@/data/catalog";
import { useCart } from "@/lib/cart";
import { formatBRL } from "@/lib/order";

export function ProductDetailsDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { add } = useCart();
  const [zoom, setZoom] = useState(1);
  const soldOut = product.status === "out_of_stock";

  function addProduct() {
    if (soldOut) return;
    add({ id: product.id, name: product.name, price: product.price });
    toast.success(`${product.name} adicionado ao carrinho`);
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setZoom(1);
        onOpenChange(value);
      }}
    >
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto p-4 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="relative h-72 overflow-auto rounded-2xl border border-border bg-card sm:h-96">
              <img
                src={product.image}
                alt={product.name}
                className="h-full object-contain p-3 transition-[width]"
                style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
              />
            </div>
            <div className="mt-2 flex items-center justify-center gap-2" aria-label="Controles de zoom">
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

          <div className="flex flex-col">
            <DialogHeader>
              <DialogTitle className="pr-6 font-display text-2xl font-extrabold uppercase leading-tight">
                {product.name}
              </DialogTitle>
              <DialogDescription className="pt-2 text-left text-sm leading-relaxed">
                {product.description}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex gap-3 rounded-xl bg-muted p-3 text-sm">
              <Ruler className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-bold">Tamanho / Dimensões</p>
                <p className="mt-1 text-muted-foreground">{product.dimensions || "Consulte o vendedor."}</p>
              </div>
            </div>
            <p className="mt-5 font-display text-3xl font-extrabold text-primary">
              {formatBRL(product.price)}
              <span className="ml-1 font-sans text-sm font-medium text-muted-foreground">/unidade</span>
            </p>
            {soldOut && <p className="mt-2 text-sm font-bold text-destructive">Produto esgotado no momento.</p>}
            <Button variant="cta" className="mt-5 h-12 w-full" onClick={addProduct} disabled={soldOut}>
              <ShoppingCart /> {soldOut ? "Produto esgotado" : "Adicionar ao carrinho"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
