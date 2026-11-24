import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, PackageCheck, PackageX, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { categoryLabel, type CategoryId } from "@/data/catalog";
import { formatBRL } from "@/lib/order";
import { resolveProductImage } from "@/lib/products";

type ProductRowType = Tables<"products">;

type RecordWithImage = { product: ProductRowType; image: string; saving: boolean };

export function QuickControlPanel() {
  const [records, setRecords] = useState<RecordWithImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const images = useRef(new Map<string, string>());

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from("products").select("*").order("created_at");
    if (error) {
      toast.error("Não foi possível carregar os produtos");
    } else {
      setRecords(
        await Promise.all(
          (data ?? []).map(async (product) => ({
            product,
            image:
              images.current.get(product.id) ?? (await resolveProductImage(product)),
            saving: false,
          })),
        ),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function setStatus(product: ProductRowType, status: ProductRowType["status"]) {
    setRecords((current) =>
      current.map((record) =>
        record.product.id === product.id ? { ...record, saving: true } : record,
      ),
    );
    const { error } = await supabase
      .from("products")
      .update({ status })
      .eq("id", product.id);
    if (error) {
      toast.error(`Não foi possível atualizar ${product.name}`);
      void reload();
    } else {
      setRecords((current) =>
        current.map((record) =>
          record.product.id === product.id
            ? { ...record, product: { ...record.product, status }, saving: false }
            : record,
        ),
      );
      toast.success(`${product.name}: ${statusLabel(status)}`);
    }
  }

  const term = query
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const filtered = records.filter(({ product }) => {
    if (!term) return true;
    const hay = `${product.name} ${product.description} ${categoryLabel(product.category as CategoryId)}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return hay.includes(term);
  });

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {records.length} produtos · chaves salvam automaticamente no banco de dados
        </p>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar produto..."
            className="pl-9"
            aria-label="Buscar produto no controle rápido"
          />
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {filtered.map(({ product, image, saving }) => {
            const available = product.status === "available";
            const unavailable = product.status === "out_of_stock";
            const hidden = product.status === "hidden";
            return (
              <li
                key={product.id}
                className={`flex items-center gap-3 p-3 transition-opacity ${hidden ? "opacity-60" : ""}`}
              >
                <img
                  src={image}
                  alt=""
                  className="size-12 shrink-0 rounded-lg border border-border bg-background object-contain p-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold leading-tight">{product.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {categoryLabel(product.category as CategoryId)} ·{" "}
                    {formatBRL(Number(product.price))}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    {saving && <Loader2 className="size-3.5 animate-spin text-primary" />}
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                      DISP
                      <Switch
                        checked={available}
                        disabled={saving}
                        onCheckedChange={(checked) =>
                          void setStatus(product, checked ? "available" : "hidden")
                        }
                        aria-label={`Chave de disponibilidade de ${product.name}`}
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                      INDISP
                      <Switch
                        checked={unavailable}
                        disabled={saving}
                        onCheckedChange={(checked) =>
                          void setStatus(product, checked ? "out_of_stock" : "hidden")
                        }
                        aria-label={`Chave de indisponibilidade de ${product.name}`}
                      />
                    </label>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${hidden ? "bg-muted text-muted-foreground" : available ? "bg-secondary text-secondary-foreground" : "bg-destructive text-destructive-foreground"}`}
                  >
                    {available ? (
                      <PackageCheck className="size-3" />
                    ) : unavailable ? (
                      <PackageX className="size-3" />
                    ) : (
                      <EyeOff className="size-3" />
                    )}
                    {available ? "Disponível" : unavailable ? "Indisponível" : "Oculto"}
                  </span>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="p-8 text-center text-sm text-muted-foreground">
              Nenhum produto encontrado para "{query.trim()}".
            </li>
          )}
        </ul>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        {hiddenLegendIcon()}{" "}
        <span>
          DISP ligado = produto visível e à venda · INDISP ligado = visível com aviso
          "INDISPONÍVEL" e compra bloqueada · ambas desligadas = oculto da vitrine pública.
        </span>
      </p>
    </section>
  );
}

function hiddenLegendIcon() {
  return <Eye className="mt-0.5 size-3.5 shrink-0" />;
}

function statusLabel(status: ProductRowType["status"]) {
  return status === "available" ? "disponível" : status === "out_of_stock" ? "indisponível" : "oculto";
}
