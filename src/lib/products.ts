import { useCallback, useEffect, useState } from "react";
import potes from "@/assets/produto-potes.jpg";
import luminaria from "@/assets/produto-luminaria.jpg";
import organizador from "@/assets/produto-organizador.jpg";
import pinceis from "@/assets/produto-pinceis.jpg";
import canetas from "@/assets/produto-canetas.jpg";
import cubo from "@/assets/produto-cubo.jpg";
import chaves from "@/assets/produto-chaves.jpg";
import fone from "@/assets/produto-fone.jpg";
import logoAsset from "@/assets/giga-shopping-logo.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  products as fallbackProducts,
  type CategoryId,
  type Product,
  type ProductTag,
} from "@/data/catalog";
import { getProductImageUrl } from "@/lib/products.functions";

export const productImages: Record<string, string> = {
  potes,
  luminaria,
  organizador,
  pinceis,
  canetas,
  cubo,
  chaves,
  fone,
};

const validTags: ProductTag[] = ["oferta", "mais-vendido", "novidade", "destaque"];

export async function resolveProductImage(
  row: Pick<Tables<"products">, "id" | "image_key" | "image_url">,
) {
  if (row.image_url) {
    if (/^https?:\/\//.test(row.image_url)) return row.image_url;
    try {
      const { imageUrl } = await getProductImageUrl({ data: { productId: row.id } });
      if (imageUrl) return imageUrl;
    } catch {
      // Keep the bundled fallback when a private photo is unavailable.
    }
  }
  return (
    (row.image_key && productImages[row.image_key]) ||
    fallbackProducts.find((product) => product.id === row.id)?.image ||
    logoAsset.url
  );
}

export function mapProduct(row: Tables<"products">, image: string): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    image,
    imageKey: row.image_key,
    imagePath: row.image_url,
    dimensions: row.dimensions,
    status:
      row.status === "out_of_stock" || row.status === "hidden"
        ? (row.status as Product["status"])
        : "available",
    maxPerCustomer: row.max_per_customer,
    category: row.category as CategoryId,
    tags: row.tags.filter((tag): tag is ProductTag => validTags.includes(tag as ProductTag)),
  };
}

export async function fetchCatalogProducts() {
  const { data, error } = await supabase.from("products").select("*").order("created_at");
  if (error) throw error;
  return Promise.all(
    (data ?? []).map(async (row) => mapProduct(row, await resolveProductImage(row))),
  );
}

export function useCatalogProducts() {
  const [items, setItems] = useState<Product[]>(fallbackProducts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchCatalogProducts();
      setItems(all.filter((product) => product.status !== "hidden"));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { products: items, loading, error, reload };
}
