import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { categories, categoryLabel, UNIQUE_PRICE, type CategoryId, type ProductTag } from "@/data/catalog";
import { formatBRL } from "@/lib/order";
import { resolveProductImage } from "@/lib/products";

const tagOptions: Array<{ id: ProductTag; label: string }> = [
  { id: "oferta", label: "Oferta" },
  { id: "mais-vendido", label: "Mais vendido" },
  { id: "novidade", label: "Novidade" },
  { id: "destaque", label: "Destaque" },
];

type RecordWithImage = { product: Tables<"products">; image: string };

export function ProductsPanel() {
  const [records, setRecords] = useState<RecordWithImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Tables<"products"> | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from("products").select("*").order("created_at");
    if (error) toast.error("Não foi possível carregar os produtos");
    else setRecords(await Promise.all((data ?? []).map(async (product) => ({ product, image: await resolveProductImage(product) }))));
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  async function remove(product: Tables<"products">) {
    if (!window.confirm(`Excluir ${product.name}?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) toast.error("Não foi possível excluir o produto");
    else { toast.success("Produto excluído"); await reload(); }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{records.length} produtos cadastrados</p>
        <Button variant="cta" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Novo produto</Button>
      </div>
      {loading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div> : (
        <div className="grid gap-3 md:grid-cols-2">
          {records.map(({ product, image }) => (
            <article key={product.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
              <img src={image} alt="" className="size-24 shrink-0 rounded-xl border border-border object-contain p-1" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold leading-tight">{product.name}</h3>
                  <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold ${product.status === "available" ? "bg-secondary text-secondary-foreground" : "bg-destructive text-destructive-foreground"}`}>
                    {product.status === "available" ? "Disponível" : "Esgotado"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{categoryLabel(product.category as CategoryId)}</p>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{product.dimensions}</p>
                <p className="mt-2 font-display text-lg font-extrabold text-primary">{formatBRL(Number(product.price))}</p>
                <div className="mt-2 flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(product); setFormOpen(true); }}><Pencil /> Editar</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void remove(product)}><Trash2 /> Excluir</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {formOpen && (
        <ProductForm key={editing?.id ?? "new"} product={editing} onClose={() => setFormOpen(false)} onSaved={async () => { setFormOpen(false); await reload(); }} />
      )}
    </section>
  );
}

function ProductForm({ product, onClose, onSaved }: { product: Tables<"products"> | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(String(product?.price ?? UNIQUE_PRICE).replace(".", ","));
  const [category, setCategory] = useState(product?.category ?? "cozinha");
  const [dimensions, setDimensions] = useState(product?.dimensions ?? "");
  const [maxPerCustomer, setMaxPerCustomer] = useState(product?.max_per_customer ? String(product.max_per_customer) : "");
  const [status, setStatus] = useState(product?.status ?? "available");
  const [tags, setTags] = useState<ProductTag[]>((product?.tags ?? []) as ProductTag[]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const numericPrice = Number(price.replace(",", "."));
    const numericLimit = maxPerCustomer.trim() === "" ? 0 : Number(maxPerCustomer);
    if (!Number.isInteger(numericLimit) || numericLimit < 0) {
      toast.error("O limite por cliente deve ser um número inteiro igual ou maior que zero"); return;
    }
    if (!name.trim() || !description.trim() || !dimensions.trim() || !Number.isFinite(numericPrice) || numericPrice < 0) {
      toast.error("Preencha nome, descrição, dimensões e um preço válido"); return;
    }
    if (file && (file.size > 5 * 1024 * 1024 || !file.type.startsWith("image/"))) {
      toast.error("Escolha uma imagem de até 5 MB"); return;
    }
    setBusy(true);
    const id = product?.id ?? `${name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
    let imagePath = product?.image_url ?? null;
    let imageKey = product?.image_key ?? null;
    if (file) {
      const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${id}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
      if (error) { setBusy(false); toast.error("Não foi possível enviar a foto"); return; }
      imagePath = path;
      imageKey = null;
    }
    const { error } = await supabase.from("products").upsert({
      id, name: name.trim(), description: description.trim(), price: numericPrice,
      category, dimensions: dimensions.trim(), status, tags, image_url: imagePath, image_key: imageKey,
      max_per_customer: numericLimit,
    });
    setBusy(false);
    if (error) toast.error("Não foi possível salvar o produto");
    else { toast.success(product ? "Produto atualizado" : "Produto cadastrado"); await onSaved(); }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{product ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="product-name">Nome</Label><Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="product-description">Descrição completa</Label><textarea id="product-description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
          <div className="space-y-1.5"><Label htmlFor="product-price">Preço (R$)</Label><Input id="product-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label htmlFor="product-category">Categoria</Label><Select value={category} onValueChange={setCategory}><SelectTrigger id="product-category"><SelectValue /></SelectTrigger><SelectContent>{categories.filter((item) => item.id !== "novidades").map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="product-dimensions">Tamanho / Dimensões</Label><Input id="product-dimensions" value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="Ex.: Aproximadamente 20 × 15 cm" required /></div>
          <div className="space-y-1.5"><Label htmlFor="product-limit">Limite máximo por cliente</Label><Input id="product-limit" type="number" min="0" step="1" inputMode="numeric" value={maxPerCustomer} onChange={(e) => setMaxPerCustomer(e.target.value)} placeholder="0 = sem limite" /><p className="text-xs text-muted-foreground">Vazio ou 0: sem limite. O histórico de pedidos não cancelados conta no limite.</p></div>
          <div className="space-y-1.5"><Label htmlFor="product-status">Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger id="product-status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="available">Disponível</SelectItem><SelectItem value="out_of_stock">Esgotado</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="product-photo">Nova foto (até 5 MB)</Label><label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm text-muted-foreground"><Upload className="size-4" /><span className="truncate">{file?.name ?? "Escolher imagem"}</span><input id="product-photo" type="file" accept="image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label></div>
          <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-medium">Seções da vitrine</legend><div className="grid grid-cols-2 gap-3">{tagOptions.map((tag) => <label key={tag.id} className="flex items-center gap-2 text-sm"><Checkbox checked={tags.includes(tag.id)} onCheckedChange={(checked) => setTags((current) => checked ? [...current, tag.id] : current.filter((item) => item !== tag.id))} />{tag.label}</label>)}</div></fieldset>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" variant="cta" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Salvar produto</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
