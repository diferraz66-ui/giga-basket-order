import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin, Sparkles, Star, Tag } from "lucide-react";
import banner from "@/assets/banner-ofertas.jpg";
import storeBackground from "@/assets/fundo-vitrine-giga.png.asset.json";
import { categoryLabel, searchProducts, type CategoryId } from "@/data/catalog";
import { useAuth } from "@/lib/auth";
import { useCatalogProducts } from "@/lib/products";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
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
  const [reviews, setReviews] = useState<Tables<"product_reviews">[]>([]);
  useEffect(() => {
    let current = true;
    void supabase
      .from("product_reviews")
      .select("*")
      .eq("status", "aprovado")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (current) setReviews(data ?? []);
      });
    return () => { current = false; };
  }, []);
  const reviewStats = useMemo(() => {
    const grouped: Record<string, { total: number; count: number }> = {};
    for (const review of reviews) {
      const current = grouped[review.product_id] ?? { total: 0, count: 0 };
      current.total += review.rating;
      current.count += 1;
      grouped[review.product_id] = current;
    }
    return Object.fromEntries(
      Object.entries(grouped).map(([id, value]) => [id, { average: value.total / value.count, count: value.count }]),
    ) as Record<string, { average: number; count: number }>;
  }, [reviews]);
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
                  <ProductCard key={product.id} product={product} layout={view} reviewSummary={reviewStats[product.id]} />
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
              title="Mais Vendidos"
              icon={<Star className="size-5 text-highlight" />}
              products={products.filter((product) => product.tags.includes("mais-vendido"))}
              view={view}
              reviewStats={reviewStats}
            />
            <ProductRow
              title="Novidades"
              icon={<Sparkles className="size-5 text-highlight" />}
              products={products.filter((product) => product.tags.includes("novidade"))}
              view={view}
              reviewStats={reviewStats}
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
        <p className="mx-auto mt-3 max-w-xl rounded-lg border border-white/20 bg-white/10 px-3 py-2 font-semibold text-ink-foreground">
          💳 Pagamento somente via PIX
        </p>
        <section className="mx-auto mt-8 max-w-6xl text-left">
          <h2 className="mb-3 text-center font-display text-lg font-extrabold uppercase text-ink-foreground sm:text-xl">
            ⭐ CLIENTES SATISFEITOS — AVALIAÇÕES REAIS
          </h2>
          {reviews.length > 0 ? (
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-3">
              {reviews.slice(0, 8).map((review) => {
                const product = products.find((item) => item.id === review.product_id);
                return (
                  <article key={review.id} className="w-72 shrink-0 rounded-xl border border-white/10 bg-white/10 p-3 text-ink-foreground">
                    <div className="flex gap-0.5" aria-label={`${review.rating} de 5 estrelas`}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className={star <= review.rating ? "text-yellow-400" : "text-white/30"}>★</span>
                      ))}
                    </div>
                    <p className="mt-2 line-clamp-4 min-h-16 text-sm leading-relaxed">“{review.comment}”</p>
                    <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                      {product && <img src={product.image} alt={product.name} className="size-11 rounded-lg bg-white object-contain p-1" />}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">{review.customer_name}</p>
                        <p className="truncate text-[11px] text-ink-foreground/70">{review.city}</p>
                        {product && <p className="truncate text-[10px] text-ink-foreground/60">{product.name}</p>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/10 px-4 py-6 text-center text-sm text-ink-foreground/70">
              Em breve, você poderá conferir aqui as avaliações reais dos nossos clientes.
            </p>
          )}
        </section>
        <div className="mx-auto mt-6 flex max-w-3xl items-start justify-center gap-2 text-center text-sm font-semibold text-ink-foreground">
          <MapPin className="mt-0.5 size-5 shrink-0 text-highlight" />
          <p>Rua Sete de Setembro, nº 133 / 141 — Centro, Santo Antônio de Jesus, BA (próximo à Caixa Econômica Federal e à Farmácia de Cristina)</p>
        </div>
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
    <div className="whitespace-nowrap bg-highlight px-2 py-2 text-center font-display text-[10px] font-extrabold leading-none text-highlight-foreground sm:px-3 sm:py-2.5 sm:text-sm">
      🛍️ PEDIDO MÍNIMO: R$ 75,00 (10 ITENS)  •  💳 PAGAMENTO SOMENTE VIA PIX
    </div>
  );
}
