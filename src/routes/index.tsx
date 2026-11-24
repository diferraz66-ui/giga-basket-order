import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Sparkles, Star, Tag } from "lucide-react";
import banner from "@/assets/banner-ofertas.jpg";
import storeBackground from "@/assets/fundo-vitrine-giga.png.asset.json";
import { categoryLabel, searchProducts, type CategoryId } from "@/data/catalog";
import { useAuth } from "@/lib/auth";
import { useCatalogProducts } from "@/lib/products";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { CategoryBar } from "@/components/catalog/CategoryBar";
import { ProductRow } from "@/components/catalog/ProductRow";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CartSheet } from "@/components/catalog/CartSheet";
import { StoreWelcomeDialog } from "@/components/catalog/StoreWelcomeDialog";
import { CatalogViewToggle, type CatalogView } from "@/components/catalog/CatalogViewToggle";
import { TopBannerCarousel } from "@/components/catalog/TopBannerCarousel";

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
  return <Catalog />;
}

function Catalog() {
  const { profile } = useAuth();
  const { products } = useCatalogProducts();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [view, setView] = useState<CatalogView>("grid");
  const filtering = query.trim() !== "" || category !== null;
  const results = useMemo(
    () => searchProducts(products, query, category),
    [products, query, category],
  );
  const firstName = profile?.full_name.split(" ")[0];

  return (
    <div
      className="flex min-h-screen flex-col bg-background bg-cover bg-fixed bg-center"
      style={{ backgroundImage: `url(${storeBackground.url})` }}
    >
      <CatalogHeader query={query} onQueryChange={setQuery} products={products} />
      <MinimumOrderNotice />
      <CategoryBar active={category} onChange={setCategory} />
      <main className="mx-auto w-full max-w-6xl flex-1">
        {filtering ? (
          <section className="px-3 pt-6 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl uppercase text-primary-foreground">
                {category ? categoryLabel(category) : "Resultados"}
                {query.trim() && (
                  <span className="ml-2 font-sans text-sm font-normal normal-case text-primary-foreground/80">
                    para "{query.trim()}"
                  </span>
                )}
              </h1>
              <CatalogViewToggle value={view} onChange={setView} />
            </div>
            {results.length === 0 ? (
              <p className="mt-10 text-center text-primary-foreground/80">
                Nenhum produto encontrado. Tente outra busca ou categoria.
              </p>
            ) : (
              <div
                className={
                  view === "grid"
                    ? "mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                    : "mt-4 grid gap-3"
                }
              >
                {results.map((product) => (
                  <ProductCard key={product.id} product={product} layout={view} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            <TopBannerCarousel />
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
                    <p className="text-sm font-medium text-primary-foreground/90">
                      Olá, {firstName}!
                    </p>
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
            <div className="mt-4 flex justify-end px-3 sm:px-5">
              <CatalogViewToggle value={view} onChange={setView} />
            </div>
            <ProductRow
              title="Ofertas Especiais"
              icon={<Flame className="size-5 text-highlight" />}
              products={products.filter((product) => product.tags.includes("oferta"))}
              view={view}
            />
            <ProductRow
              title="Mais Vendidos"
              icon={<Star className="size-5 text-highlight" />}
              products={products.filter((product) => product.tags.includes("mais-vendido"))}
              view={view}
            />
            <ProductRow
              title="Novidades"
              icon={<Sparkles className="size-5 text-highlight" />}
              products={products.filter((product) => product.tags.includes("novidade"))}
              view={view}
            />
            <ProductRow
              title="Produtos em Destaque"
              products={products.filter((product) => product.tags.includes("destaque"))}
              view={view}
            />
          </>
        )}
      </main>
      <footer className="mt-12 bg-ink px-5 py-8 text-center text-xs text-ink-foreground/70">
        <p className="font-display text-sm font-extrabold text-ink-foreground">GIGA SHOPPING</p>
        <p className="mt-1">Catálogo digital · Pedidos pelo WhatsApp</p>
        <p className="mx-auto mt-4 max-w-xl rounded-lg bg-primary px-3 py-2 font-bold text-primary-foreground">
          🛍️ PEDIDO MÍNIMO PARA COMPRAS ONLINE: R$ 75,00 (10 itens de R$ 7,50)
        </p>
        <Link
          to="/area-restrita"
          className="mt-5 inline-block text-ink-foreground/50 underline underline-offset-4 hover:text-ink-foreground"
        >
          Área Restrita
        </Link>
      </footer>
      <CartSheet products={products} />
      <StoreWelcomeDialog />
    </div>
  );
}

function MinimumOrderNotice() {
  return (
    <p className="bg-highlight px-3 py-2.5 text-center font-display text-xs font-extrabold uppercase leading-snug text-highlight-foreground sm:text-sm">
      🛍️ PEDIDO MÍNIMO PARA COMPRAS ONLINE: R$ 75,00 (10 itens de R$ 7,50)
    </p>
  );
}
