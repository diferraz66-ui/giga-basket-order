import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Flame, Sparkles, Star, Tag, Loader2 } from "lucide-react";
import banner from "@/assets/banner-ofertas.jpg";
import { categoryLabel, products, searchProducts, type CategoryId } from "@/data/catalog";
import { useAuth } from "@/lib/auth";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { CategoryBar } from "@/components/catalog/CategoryBar";
import { ProductRow } from "@/components/catalog/ProductRow";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CartSheet } from "@/components/catalog/CartSheet";
import { EntryScreen } from "@/components/catalog/EntryScreen";
import { Logo } from "@/components/catalog/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GIGA SHOPPING — Catálogo Digital" },
      {
        name: "description",
        content:
          "Catálogo digital da GIGA SHOPPING: cozinha, casa, beleza, papelaria, brinquedos e muito mais. Monte seu carrinho e peça pelo WhatsApp.",
      },
      { property: "og:title", content: "GIGA SHOPPING — Catálogo Digital" },
      {
        property: "og:description",
        content: "Ofertas, mais vendidos e novidades. Peça direto pelo WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <Logo eager className="w-56" />
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <EntryScreen />;
  return <Catalog />;
}

function Catalog() {
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | null>(null);

  const filtering = query.trim() !== "" || category !== null;
  const results = useMemo(() => searchProducts(products, query, category), [query, category]);
  const firstName = profile?.full_name.split(" ")[0];

  return (
    <div className="min-h-screen bg-background pb-16">
      <CatalogHeader query={query} onQueryChange={setQuery} />
      <CategoryBar active={category} onChange={setCategory} />

      <main className="mx-auto max-w-6xl">
        {filtering ? (
          <section className="px-3 pt-6 sm:px-5">
            <h1 className="text-xl uppercase">
              {category ? categoryLabel(category) : "Resultados"}
              {query.trim() && (
                <span className="ml-2 font-sans text-sm font-normal normal-case text-muted-foreground">
                  para "{query.trim()}"
                </span>
              )}
            </h1>
            {results.length === 0 ? (
              <p className="mt-10 text-center text-muted-foreground">
                Nenhum produto encontrado. Tente outra busca ou categoria.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {results.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="px-3 pt-4 sm:px-5">
              <div className="relative overflow-hidden rounded-2xl bg-primary shadow-soft">
                <img
                  src={banner}
                  alt=""
                  width={1600}
                  height={640}
                  className="h-44 w-full object-cover object-right sm:h-64"
                />
                <div className="bg-hero-fade absolute inset-0 flex flex-col justify-center p-5 sm:p-10">
                  {firstName && (
                    <p className="text-sm font-medium text-primary-foreground/90">Olá, {firstName}!</p>
                  )}
                  <h1 className="max-w-[14ch] text-2xl uppercase leading-none text-primary-foreground sm:text-5xl">
                    Tudo por um preço só
                  </h1>
                  <p className="mt-3 inline-flex w-fit items-center gap-1 rounded-md bg-highlight px-2.5 py-1 font-display text-xs font-extrabold uppercase text-highlight-foreground sm:text-sm">
                    <Tag className="size-3.5" /> Preço único R$ 7,50
                  </p>
                </div>
              </div>
            </section>

            <ProductRow
              title="Ofertas Especiais"
              icon={<Flame className="size-5 text-primary" />}
              products={products.filter((p) => p.tags.includes("oferta"))}
            />
            <ProductRow
              title="Mais Vendidos"
              icon={<Star className="size-5 text-primary" />}
              products={products.filter((p) => p.tags.includes("mais-vendido"))}
            />
            <ProductRow
              title="Novidades"
              icon={<Sparkles className="size-5 text-primary" />}
              products={products.filter((p) => p.tags.includes("novidade"))}
            />
            <ProductRow
              title="Produtos em Destaque"
              products={products.filter((p) => p.tags.includes("destaque"))}
            />
          </>
        )}
      </main>

      <footer className="mt-12 bg-ink px-5 py-8 text-center text-xs text-ink-foreground/70">
        <p className="font-display text-sm font-extrabold text-ink-foreground">GIGA SHOPPING</p>
        <p className="mt-1">Catálogo digital · Pedidos pelo WhatsApp</p>
      </footer>

      <CartSheet />
    </div>
  );
}
