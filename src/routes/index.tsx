import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  CreditCard,
  MapPin,
  Store,
  Trophy,
  Truck,
} from "lucide-react";
import { categoryLabel, categories, searchProducts, type CategoryId } from "@/data/catalog";
import { useAuth } from "@/lib/auth";
import { assignActiveProductNumbers, useCatalogProducts } from "@/lib/products";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import { CategoryBar } from "@/components/catalog/CategoryBar";
import { ProductRow } from "@/components/catalog/ProductRow";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CartSheet } from "@/components/catalog/CartSheet";
import { StoreWelcomeDialog } from "@/components/catalog/StoreWelcomeDialog";
import { CatalogViewToggle, type CatalogView } from "@/components/catalog/CatalogViewToggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TopBannerCarousel } from "@/components/catalog/TopBannerCarousel";
import { MinimumOrderCapsule } from "@/components/catalog/MinimumOrderCapsule";

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
        content: "Ofertas, produtos mais vendidos e novidades da GIGA SHOPPING.",
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
  const { profile, session } = useAuth();
  const { products, loading: productsLoading, error: productsError } = useCatalogProducts({ publicCatalog: true });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [bestSellersOpen, setBestSellersOpen] = useState(false);
  const [view, setView] = useState<CatalogView>("grid");
  const [reviews, setReviews] = useState<Tables<"product_reviews">[]>([]);
  const [salesByProduct, setSalesByProduct] = useState<Record<string, number>>({});
  const [minimumItems, setMinimumItems] = useState(10);

  useEffect(() => {
    let active = true;
    async function loadMinimum() {
      const { data } = await supabase.from("configuracoes_loja").select("limite_minimo_pedido").eq("id", 1).maybeSingle();
      const value = Number(data?.limite_minimo_pedido ?? 10);
      if (active && Number.isInteger(value) && value >= 1) setMinimumItems(value);
    }
    void loadMinimum();
    const channel = supabase.channel("giga-catalog-minimum")
      .on("postgres_changes", { event: "*", schema: "public", table: "configuracoes_loja", filter: "id=eq.1" }, payload => {
        const value = Number((payload.new as { limite_minimo_pedido?: number })?.limite_minimo_pedido);
        if (Number.isInteger(value) && value >= 1) setMinimumItems(value);
      }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, []);

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

  useEffect(() => {
    let current = true;
    void supabase
      .from("orders")
      .select("items")
      .eq("status", "completed")
      .then(({ data }) => {
        if (!current) return;
        const totals: Record<string, number> = {};
        for (const order of data ?? []) {
          if (!Array.isArray(order.items)) continue;
          for (const raw of order.items) {
            if (!raw || typeof raw !== "object") continue;
            const item = raw as { id?: unknown; quantity?: unknown };
            if (typeof item.id !== "string" || typeof item.quantity !== "number") continue;
            totals[item.id] = (totals[item.id] ?? 0) + item.quantity;
          }
        }
        setSalesByProduct(totals);
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
  const sequenceById = useMemo(() => new Map(products.map((product, index) => [product.id, index + 1])), [products]);
  const firstName = profile?.full_name.split(" ")[0];
  const [publishedToastQueue, setPublishedToastQueue] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !profile) return;
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function subscribeForCustomers(customerId: string) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", customerId);
      if (!active || roles?.some(item => item.role === "admin" || item.role === "vendedor")) return;

      channel = supabase
      .channel(`giga-published-products-${customerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "products", filter: "status_aprovacao=eq.aprovado" }, payload => {
        const row = payload.new as { id?: string; name?: string; status_aprovacao?: string };
        if (!active || row.status_aprovacao !== "aprovado" || !row.id) return;
        const id = row.id;
        setPublishedToastQueue(queue => queue.some(item => item.id === id) ? queue : [...queue, { id, name: row.name ?? "Novo produto" }]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "products", filter: "status_aprovacao=eq.aprovado" }, payload => {
        const row = payload.new as { id?: string; name?: string; status_aprovacao?: string };
        const old = payload.old as { status_aprovacao?: string };
        if (!active || row.status_aprovacao !== "aprovado" || !old.status_aprovacao || old.status_aprovacao === "aprovado" || !row.id) return;
        const id = row.id;
        setPublishedToastQueue(queue => queue.some(item => item.id === id) ? queue : [...queue, { id, name: row.name ?? "Produto aprovado" }]);
      })
      .subscribe();
    }

    void subscribeForCustomers(userId);
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [session?.user?.id, profile]);

  const bestSellers = useMemo(() => {
    const tagged = products.filter((product) => product.tags.includes("mais-vendido"));
    const taggedIds = new Set(tagged.map((product) => product.id));
    const ranked = products
      .filter((product) => (salesByProduct[product.id] ?? 0) > 0 && !taggedIds.has(product.id))
      .sort((a, b) =>
        (salesByProduct[b.id] ?? 0) - (salesByProduct[a.id] ?? 0) ||
        a.name.localeCompare(b.name, "pt-BR"),
      );
    return [...tagged, ...ranked].slice(0, 100);
  }, [products, salesByProduct]);

  const categorySections = [
    categories.find((item) => item.id === "cozinha")!,
    categories.find((item) => item.id === "casa-decoracao")!,
    categories.find((item) => item.id === "organizacao")!,
    categories.find((item) => item.id === "utilidades")!,
    categories.find((item) => item.id === "beleza")!,
  ];

  return (
    <div className="flex min-h-screen flex-col bg-cover bg-center bg-fixed bg-no-repeat" style={{ backgroundImage: "url('/bg-giga-red.webp')" }}>
      <div className="sticky top-0 z-50">
        <CatalogHeader query={query} onQueryChange={setQuery} products={products} />
        <MinimumOrderNotice minimumItems={minimumItems} />
        <CategoryBar active={category} onChange={(value) => { setCategory(value); setBestSellersOpen(false); }} />
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4">
        {filtering ? (
          <section className="pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl uppercase text-white">
                {category ? categoryLabel(category) : "Resultados"}
                {query.trim() && (
                  <span className="ml-2 font-sans text-sm font-normal normal-case text-white/70">
                    para "{query.trim()}"
                  </span>
                )}
              </h1>
              <CatalogViewToggle value={view} onChange={setView} />
            </div>
            {results.length === 0 ? (
              <p className="mt-10 text-center text-white">
                Nenhum produto encontrado. Tente outra busca ou categoria.
              </p>
            ) : (
              <div className={view === "grid" ? "mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "mt-4 grid gap-3"}>
                {results.map((product) => (
                  <ProductCard key={product.id} product={product} layout={view} reviewSummary={reviewStats[product.id]} sequence={sequenceById.get(product.id)} />
                ))}
              </div>
            )}
          </section>
        ) : bestSellersOpen ? (
          <section className="pt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-white/80">Seleção GIGA</p>
                <h1 className="text-2xl uppercase text-white">Os 100 Mais Vendidos</h1>
              </div>
              <button type="button" onClick={() => setBestSellersOpen(false)} className="rounded-full border border-white/60 px-4 py-2 text-sm font-bold text-white hover:bg-white hover:text-[#111827]">Voltar à vitrine</button>
            </div>
            {bestSellers.length ? (
              <div className={view === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "grid gap-3"}>
                {bestSellers.map((product) => (
                  <ProductCard key={product.id} product={product} layout={view} reviewSummary={reviewStats[product.id]} sequence={sequenceById.get(product.id)} />
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-white p-8 text-center text-sm text-gray-600">Ainda não há vendas concluídas ou produtos marcados como mais vendidos.</p>
            )}
          </section>
        ) : (
          <>
            <TopBannerCarousel />
            <section aria-label="Atalhos da loja" className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 no-scrollbar md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
              <ShortcutCard icon={<MapPin className="size-6 text-[#DC2626]" />} title="Localização da Loja" action="Ver no mapa" onClick={() => window.open("https://www.google.com/maps/search/?api=1&query=Rua+Sete+de+Setembro+141+Centro+Santo+Antonio+de+Jesus+BA", "_blank", "noopener,noreferrer")} description="Rua Sete de Setembro, 141, Centro, Santo Antônio de Jesus - BA" />
              <ShortcutCard icon={<Trophy className="size-6 text-[#D4AF37]" />} title="Os 100 Mais Vendidos" action="Ver lista" onClick={() => setBestSellersOpen(true)} description="Ranking por vendas concluídas e seleção da equipe GIGA." />
              <ShortcutCard icon={<CreditCard className="size-6 text-[#111827]" />} title="Pagamento via Pix" action="Saiba mais" onClick={() => window.dispatchEvent(new CustomEvent("giga:show-pix-info"))} description="Pagamento exclusivo via Pix. Pedido mínimo de 10 itens ou R$ 75,00." />
              <ShortcutCard icon={<Truck className="size-6 text-[#B91C1C]" />} title="Retirada ou Van Regional" action="Como funciona" onClick={() => window.dispatchEvent(new CustomEvent("giga:show-delivery-info"))} description="Retirada rápida no Centro de SAJ ou despacho pelas vans da região." />
            </section>

            <div className="mt-5 flex justify-end">
              <CatalogViewToggle value={view} onChange={setView} />
            </div>

            {productsLoading ? (
              <section aria-label="Carregando produtos" aria-busy="true" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }, (_, index) => (
                  <div key={index} className="h-64 animate-pulse rounded-xl border border-white/20 bg-white/15" />
                ))}
              </section>
            ) : productsError ? (
              <p role="status" className="mt-8 rounded-xl bg-white/95 p-6 text-center text-sm text-gray-700">
                Não foi possível carregar os produtos agora. Atualize a página para tentar novamente.
              </p>
            ) : (
              categorySections.map((item, index) => {
                const categoryProducts = products
                  .filter((product) => product.category === item.id && product.status === "available")
                  .slice(0, 8);
                if (!categoryProducts.length) return null;
                return (
                  <section key={item.id} className="mt-8">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="h-7 w-1.5 rounded-full bg-white" />
                        <h2 className="text-lg uppercase text-white sm:text-xl">{String(index + 1).padStart(2, "0")} {item.label}</h2>
                      </div>
                      <button type="button" onClick={() => setCategory(item.id)} className="shrink-0 text-sm font-extrabold text-white hover:underline">Ver mais →</button>
                    </div>
                    <div className={view === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" : "grid gap-3"}>
                      {categoryProducts.map((product) => (
                        <ProductCard key={product.id} product={product} layout={view} reviewSummary={reviewStats[product.id]} sequence={sequenceById.get(product.id)} />
                      ))}
                    </div>
                  </section>
                );
                })
            )}
          </>
        )}
      </main>

      <footer className="mt-12 bg-[#111827] px-5 py-8 text-center text-xs text-white/70">
        <p className="font-display text-sm font-extrabold text-white">GIGA SHOPPING</p>
        <p className="mt-1">Catálogo digital · Pedidos pelo WhatsApp</p>
        <div className="mt-4 flex justify-center">
          <MinimumOrderCapsule minimumItems={minimumItems} />
        </div>
        <section className="mx-auto mt-8 max-w-6xl text-left">
          <h2 className="mb-3 text-center font-display text-lg font-extrabold uppercase text-white sm:text-xl">CLIENTES SATISFEITOS · AVALIAÇÕES REAIS</h2>
          {reviews.length > 0 ? (
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-3">
              {reviews.slice(0, 8).map((review) => {
                const product = products.find((item) => item.id === review.product_id);
                return (
                  <article key={review.id} className="w-72 shrink-0 rounded-xl border border-white/10 bg-white/10 p-3 text-white">
                    <div className="flex gap-0.5" aria-label={`${review.rating} de 5 estrelas`}>
                      {[1, 2, 3, 4, 5].map((star) => <span key={star} className={star <= review.rating ? "text-[#D4AF37]" : "text-white/30"}>★</span>)}
                    </div>
                    <p className="mt-2 line-clamp-4 min-h-16 text-sm leading-relaxed">“{review.comment}”</p>
                    <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                      {product && <img src={product.image} alt={product.name} className="size-11 rounded-lg bg-white object-contain p-1" />}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">{review.customer_name}</p>
                        <p className="truncate text-[11px] text-white/70">{review.city}</p>
                        {product && <p className="truncate text-[10px] text-white/60">{product.name}</p>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/10 px-4 py-6 text-center text-sm text-white/70">Em breve, você poderá conferir aqui as avaliações reais dos nossos clientes.</p>
          )}
        </section>
        <div className="mx-auto mt-6 max-w-3xl text-center text-sm font-semibold text-white">
          <p>Rua Sete de Setembro, nº 141 — Centro, Santo Antônio de Jesus, BA</p>
        </div>
        <a href="/area-restrita" className="mt-5 inline-block text-white/50 underline underline-offset-4 hover:text-white">Área Restrita</a>
      </footer>
      {publishedToastQueue.length > 0 && (
        <div className="fixed bottom-24 right-4 z-[70] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
          {publishedToastQueue.slice(0, 2).map(item => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-card p-3 shadow-xl">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl">🛍️</div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold uppercase">Novidade na GIGA</p>
                <p className="truncate text-sm text-muted-foreground">{item.name}</p>
              </div>
              <button type="button" className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" onClick={() => {
                const node = document.querySelector(`[data-product-id="${CSS.escape(item.id)}"]`);
                node?.scrollIntoView({ behavior: "smooth", block: "center" });
                node?.classList.add("ring-4", "ring-primary");
                window.setTimeout(() => node?.classList.remove("ring-4", "ring-primary"), 2200);
                setPublishedToastQueue(queue => queue.filter(entry => entry.id !== item.id));
              }}>Ver produto</button>
              <button type="button" aria-label="Fechar notificação" className="text-muted-foreground" onClick={() => setPublishedToastQueue(queue => queue.filter(entry => entry.id !== item.id))}>×</button>
            </div>
          ))}
        </div>
      )}
      <CartSheet products={products} />
      <StoreWelcomeDialog />
      <StoreInfoDialogs />
    </div>
  );
}

function MinimumOrderNotice({ minimumItems }: { minimumItems: number }) {
  return (
    <div className="flex justify-center bg-ink px-3 py-1.5">
      <MinimumOrderCapsule minimumItems={minimumItems} />
    </div>
  );
}

function ShortcutCard({ icon, title, description, action, onClick }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <article className="flex min-h-36 min-w-[230px] max-w-[250px] shrink-0 snap-start flex-col rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm md:min-w-0 md:max-w-none md:p-4">
      <div className="flex items-center gap-2">{icon}<h3 className="text-sm font-extrabold text-[#111827]">{title}</h3></div>
      <p className="mt-2 flex-1 text-xs leading-relaxed text-gray-600">{description}</p>
      <button type="button" onClick={onClick} className="mt-3 w-fit rounded-lg bg-[#DC2626] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#B91C1C]">{action}</button>
    </article>
  );
}

function StoreInfoDialogs() {
  const [kind, setKind] = useState<"pix" | "delivery" | null>(null);
  useEffect(() => {
    const pix = () => setKind("pix");
    const delivery = () => setKind("delivery");
    window.addEventListener("giga:show-pix-info", pix);
    window.addEventListener("giga:show-delivery-info", delivery);
    return () => {
      window.removeEventListener("giga:show-pix-info", pix);
      window.removeEventListener("giga:show-delivery-info", delivery);
    };
  }, []);
  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && setKind(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold uppercase text-[#111827]">
            {kind === "pix" ? "Pagamento via Pix" : "Retirada ou Van Regional"}
          </DialogTitle>
          <DialogDescription>
            {kind === "pix"
              ? "A GIGA Shopping trabalha exclusivamente com pagamento via Pix. O pedido mínimo para compras online é de 10 itens, totalizando R$ 75,00."
              : "Você pode retirar seu pedido na loja, no Centro de Santo Antônio de Jesus, ou combinar o despacho por uma van/transportador da sua região. Os custos de retirada e transporte são de responsabilidade do cliente."}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
