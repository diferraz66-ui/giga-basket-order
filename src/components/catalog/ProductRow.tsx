import type { ReactNode } from "react";
import type { Product } from "@/data/catalog";
import { ProductCard } from "./ProductCard";

export function ProductRow({
  title,
  icon,
  products,
}: {
  title: string;
  icon?: ReactNode;
  products: Product[];
}) {
  if (products.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2 px-3 sm:px-5">
        <span className="h-6 w-1.5 rounded-full bg-primary" />
        <h2 className="flex items-center gap-2 text-lg uppercase sm:text-xl">
          {icon}
          {title}
        </h2>
      </div>
      <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-3 pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-5 lg:grid-cols-4">
        {products.map((p) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-auto">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
