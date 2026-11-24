import type { ReactNode } from "react";
import type { Product } from "@/data/catalog";
import { ProductCard } from "./ProductCard";
import type { CatalogView } from "./CatalogViewToggle";

export function ProductRow({
  title,
  icon,
  products,
  view = "grid",
  reviewStats,
  sequenceById,
}: {
  title: string;
  icon?: ReactNode;
  products: Product[];
  view?: CatalogView;
  reviewStats?: Record<string, { average: number; count: number }>;
  sequenceById?: Map<string, number>;
}) {
  if (products.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2 px-3 sm:px-5">
        <span className="h-6 w-1.5 rounded-full bg-highlight" />
        <h2 className="flex items-center gap-2 text-lg uppercase text-primary-foreground sm:text-xl">
          {icon}
          {title}
        </h2>
      </div>
      <div
        className={
          view === "grid"
            ? "grid grid-cols-2 gap-3 px-3 pb-2 sm:grid-cols-3 sm:px-5 lg:grid-cols-4"
            : "grid gap-3 px-3 pb-2 sm:px-5"
        }
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} layout={view} reviewSummary={reviewStats?.[product.id]} sequence={sequenceById?.get(product.id)} />
        ))}
      </div>
    </section>
  );
}
