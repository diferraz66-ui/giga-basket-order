import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Camera,
  Download,
  FileSpreadsheet,
  Images,
  Loader2,
  Search,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  categories,
  categoryLabel,
  UNIQUE_PRICE,
  type CategoryId,
  type ProductTag,
} from "@/data/catalog";
import { formatBRL } from "@/lib/order";
import { assignActiveProductNumbers, fetchAllProductRows, resolveProductImage } from "@/lib/products";
import { optimizeProductImage } from "@/lib/product-image";
import {
  bulkPhotoDefaults,
  parseProductCsv,
  PRODUCT_CSV_TEMPLATE,
  productIdFromName,
  productNameFromFilename,
} from "@/lib/product-import";

const tagOptions: Array<{ id: ProductTag; label: string }> = [
  { id: "oferta", label: "Oferta" },
  { id: "mais-vendido", label: "Mais vendido" },
  { id: "novidade", label: "Novidade" },
  { id: "destaque", label: "Destaque" },
];

type RecordWithImage = { product: Tables<"products">; image: string };

function normalizeProductName(value: string, removeExtension = false) {
  const name = removeExtension ? value.replace(/\.[^/.]+$/, "") : value;
  return name
    .replace(/[\r\n\t\u200B]/g, " ")
    .trim()
    .replace(/[\s_-]+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function safeFilename(filename: string) {
  return filename
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function SellerProductForm({ sellerUserId, onClose, onSaved }: { sellerUserId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  return <ProductForm key={sellerUserId} product={null} onClose={onClose} onSaved={onSaved} sellerMode sellerUserId={sellerUserId} />;
}

export function ProductsPanel() {
  const [records, setRecords] = useState<RecordWithImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Tables<"products"> | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const linkPhotoInput = useRef<HTMLInputElement>(null);
  const [linkPhotoSummary, setLinkPhotoSummary] = useState<{ linked: number; unmatched: string[] } | null>(null);
  const [linkPhotoProgress, setLinkPhotoProgress] = useState(0);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState<"number" | "asc" | "desc">("number");
  const photoInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try {
      const data = await fetchAllProductRows();
      setRecords(await Promise.all(data.map(async (product) => ({ product, image: await resolveProductImage(product) }))));
    } catch {
      toast.error("Não foi possível carregar os produtos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const numberedRecords = assignActiveProductNumbers(records.map(({ product, image }) => ({ ...product, image }))).map((numbered) => ({
    product: records.find((record) => record.product.id === numbered.id)!.product,
    image: numbered.image,
    sequence: numbered.sequence,
  }));
  const visibleRecords = numberedRecords.filter(({ product, sequence }) => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normalizedName = product.name.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const matchesQuery = !normalizedQuery || normalizedName.includes(normalizedQuery) || String(sequence ?? "").includes(normalizedQuery) || String(sequence ?? "").padStart(2, "0").includes(normalizedQuery);
    return matchesQuery && (categoryFilter === "all" || product.category === categoryFilter);
  }).sort((a, b) => sortMode === "asc" ? a.product.name.localeCompare(b.product.name, "pt-BR") : sortMode === "desc" ? b.product.name.localeCompare(a.product.name, "pt-BR") : (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER));
  async function changeVisibility(product: Tables<"products">, hidden: boolean) {
    const { error } = await supabase.from("products").update({ status: hidden ? "hidden" : "available" }).eq("id", product.id);
    if (error) toast.error("Não foi possível alterar a visibilidade do produto");
    else { toast.success(hidden ? `${product.name} ocultado da vitrine` : `${product.name} reexibido na vitrine`); await reload(); }
  }

  async function remove(product: Tables<"products">) {
    if (!window.confirm(`Excluir ${product.name}?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) toast.error("Não foi possível excluir o produto");
    else {
      toast.success("Produto excluído");
      await reload();
    }
  }

  function downloadCsvTemplate() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", PRODUCT_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "modelo-produtos-giga.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBulkProgress("Lendo e validando o CSV...");
    try {
      const result = parseProductCsv(await file.text());
      if (result.errors.length) {
        toast.error(result.errors.slice(0, 3).join(" · "));
        return;
      }
      const { error } = await supabase.from("products").insert(
        result.rows.map((row) => ({
          id: productIdFromName(row.name),
          name: row.name,
          description: row.description,
          price: row.price,
          category: row.category,
          dimensions: row.dimensions,
          max_per_customer: row.maxPerCustomer,
          tags: row.tags,
          status: row.status,
          image_key: null,
          image_url: null,
        })),
      );
      if (error) throw error;
      toast.success(`${result.rows.length} produto(s) importado(s) com sucesso`);
      await reload();
    } catch {
      toast.error("Não foi possível importar o CSV. Confira o arquivo e tente novamente.");
    } finally {
      setBulkProgress(null);
    }
  }

  async function linkPhotosByNumber(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    setLinkPhotoProgress(0);
    setLinkPhotoSummary(null);
    setBulkProgress("Consultando produtos ativos e sua numeração atual...");

    let databaseProducts: Tables<"products">[];
    try {
      databaseProducts = await fetchAllProductRows();
    } catch {
      setBulkProgress(null);
      toast.error("Não foi possível consultar todos os produtos do estoque");
      return;
    }

    // A numeração corresponde à lista do Admin: cadastro ascendente e somente produtos ativos.
    const activeProducts = assignActiveProductNumbers(
      databaseProducts.filter((product) => product.status !== "hidden"),
    )
      .filter((product) => product.sequence !== null)
      .sort((a, b) => {
        const dateOrder = a.created_at.localeCompare(b.created_at);
        return dateOrder || a.id.localeCompare(b.id);
      });

    const productByNumber = new Map<number, Tables<"products">>();
    activeProducts.forEach((product, index) => productByNumber.set(index + 1, product));

    let linked = 0;
    const unmatched: string[] = [];
    const processedNumbers = new Set<number>();

    for (const [index, file] of files.entries()) {
      setBulkProgress(`Vinculando foto ${index + 1} de ${files.length}: ${file.name}`);

      const basename = file.name.replace(/\.[^.]+$/, "").trim();
      const numberMatch = basename.match(/^\s*(\d+)/);
      const digits = numberMatch?.[1] ?? "";
      const number = digits ? Number.parseInt(digits, 10) : NaN;
      const product = Number.isSafeInteger(number) ? productByNumber.get(number) : undefined;

      if (!file.type.startsWith("image/") || !product || processedNumbers.has(number)) {
        unmatched.push(file.name);
        setLinkPhotoProgress(Math.round(((index + 1) / files.length) * 100));
        continue;
      }

      processedNumbers.add(number);
      let uploadedPath: string | null = null;
      try {
        const optimized = { file: await optimizeProductImage(file) };
        const path = `${product.id}/${crypto.randomUUID()}-${safeFilename(optimized.file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, optimized.file, { contentType: optimized.file.type });
        if (uploadError) throw uploadError;
        uploadedPath = path;

        const { error: updateError } = await supabase
          .from("products")
          .update({ image_url: path, image_key: null })
          .eq("id", product.id);
        if (updateError) throw updateError;

        linked += 1;
        toast.success(`✅ Foto vinculada ao produto #${String(number).padStart(2, "0")} (${product.name})`);
      } catch {
        if (uploadedPath) {
          await supabase.storage.from("product-images").remove([uploadedPath]);
        }
        unmatched.push(file.name);
      }

      setLinkPhotoProgress(Math.round(((index + 1) / files.length) * 100));
    }

    setBulkProgress(null);
    await reload();
    setLinkPhotoSummary({ linked, unmatched });
    if (unmatched.length > 0) {
      toast.warning(`${unmatched.length} arquivo(s) sem correspondência ou com falha no vínculo`);
    }
    if (linked > 0) {
      toast.success(`✅ ${linked} foto(s) vinculada(s) com sucesso pelos números!`);
    }
  }

  async function importPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    let created = 0;
    let failed = 0;

    for (const [index, file] of files.entries()) {
      setBulkProgress(`Otimizando e cadastrando foto ${index + 1} de ${files.length}...`);
      if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
        failed += 1;
        continue;
      }
      try {
        const optimized = await optimizeProductImage(file);
        const name = productNameFromFilename(file.name);
        const id = productIdFromName(name);
        const path = `${id}/${crypto.randomUUID()}-${safeFilename(optimized.name)}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, optimized, { contentType: optimized.type });
        if (uploadError) throw uploadError;
        const defaults = bulkPhotoDefaults();
        const { error: insertError } = await supabase.from("products").insert({
          id,
          name,
          description: "",
          price: defaults.price,
          category: defaults.category,
          dimensions: "",
          max_per_customer: defaults.maxPerCustomer,
          tags: defaults.tags,
          status: defaults.status,
          image_key: null,
          image_url: path,
        });
        if (insertError) {
          await supabase.storage.from("product-images").remove([path]);
          throw insertError;
        }
        created += 1;
      } catch {
        failed += 1;
      }
    }

    setBulkProgress(null);
    if (created) {
      toast.success(`${created} produto(s) cadastrado(s) na categoria Novidades`);
      await reload();
    }
    if (failed)
      toast.error(`${failed} foto(s) não foram cadastradas. Use imagens válidas de até 5 MB.`);
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="w-full text-sm text-muted-foreground sm:w-auto">
          {records.length} produtos cadastrados
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={bulkProgress !== null}
            onClick={downloadCsvTemplate}
          >
            <Download /> Baixar modelo CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={bulkProgress !== null}
            onClick={() => csvInput.current?.click()}
          >
            <FileSpreadsheet /> Importar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={bulkProgress !== null}
            onClick={() => photoInput.current?.click()}
          >
            <Images /> Cadastro Rápido por Fotos (Lote)
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={bulkProgress !== null || loading}
            onClick={() => linkPhotoInput.current?.click()}
          >
            🔢 Vincular Fotos por Número
          </Button>
          <Button
            variant="cta"
            size="sm"
            disabled={bulkProgress !== null}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Novo produto
          </Button>
        </div>
        <input
          ref={csvInput}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => void importCsv(event)}
          aria-label="Selecionar CSV de produtos"
        />
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => void importPhotos(event)}
          aria-label="Selecionar fotos para cadastro em lote"
        />
        <input
          ref={linkPhotoInput}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(event) => void linkPhotosByNumber(event)}
          aria-label="Selecionar fotos para vincular aos produtos por número"
        />
      </div>
      {bulkProgress && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-muted p-3 text-sm">
          <Loader2 className="size-4 animate-spin text-primary" />
          {bulkProgress}
          <span className="sr-only">Processamento em andamento</span>
        </p>
      )}
      {bulkProgress && (
        <div className="mb-4 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground"><span>Progresso do processamento</span><span>{linkPhotoProgress}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Progresso do processamento em lote" aria-valuemin={0} aria-valuemax={100} aria-valuenow={linkPhotoProgress}>
            <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${linkPhotoProgress}%` }} />
          </div>
        </div>
      )}
      <Dialog open={linkPhotoSummary !== null} onOpenChange={(open) => !open && setLinkPhotoSummary(null)}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resultado da vinculação de fotos</DialogTitle>
          </DialogHeader>
          {linkPhotoSummary && (
            <div className="space-y-4">
              <p className="rounded-xl bg-green-50 p-4 text-sm font-bold text-green-800 dark:bg-green-950 dark:text-green-200">
                ✅ {linkPhotoSummary.linked} fotos vinculadas com sucesso pelos números!
              </p>
              {linkPhotoSummary.unmatched.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">
                    ⚠️ {linkPhotoSummary.unmatched.length} fotos não encontraram produto correspondente
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Use somente o número atual no nome do arquivo, como 01.jpg ou 15.webp. Números que não existem no estoque ficam nesta lista.
                  </p>
                  <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-3 text-sm">
                    {linkPhotoSummary.unmatched.map((filename, index) => (
                      <li key={`${filename}-${index}`} className="break-all">{filename}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Todas as imagens selecionadas foram vinculadas com sucesso.</p>
              )}
              <div className="flex justify-end">
                <Button onClick={() => setLinkPhotoSummary(null)}>Concluir</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : (
        <>
        <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(220px,1fr)_220px_220px]">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="🔍 Buscar por nº ou nome do produto..." className="pl-9" aria-label="Buscar por número ou nome do produto" /></div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger><SelectValue placeholder="Todas as Categorias" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as Categorias</SelectItem>{categories.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select>
          <Select value={sortMode} onValueChange={(value) => setSortMode(value as "number" | "asc" | "desc")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="number">Numeração (01 → 99)</SelectItem><SelectItem value="asc">Ordem Alfabética (A → Z)</SelectItem><SelectItem value="desc">Inversa (Z → A)</SelectItem></SelectContent></Select>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {visibleRecords.map(({ product, image, sequence }) => (
            <article
              key={product.id}
              className="flex gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <img
                src={image}
                alt=""
                className="size-24 shrink-0 rounded-xl border border-border object-contain p-1"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">{sequence !== null ? <span className="rounded-lg bg-primary px-2 py-1 text-sm font-extrabold text-primary-foreground">{String(sequence).padStart(2, "0")}</span> : <span className="rounded bg-muted px-2 py-1 text-[10px]">SEM Nº</span>}<h3 className="font-bold leading-tight">{product.name}</h3></div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold ${product.status === "available" ? "bg-secondary text-secondary-foreground" : product.status === "hidden" ? "bg-muted text-muted-foreground" : "bg-destructive text-destructive-foreground"}`}
                  >
                    {product.status === "available"
                      ? "Disponível"
                      : product.status === "hidden"
                        ? "Oculto"
                        : "Esgotado"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {categoryLabel(product.category as CategoryId)}
                </p>
                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                  {product.dimensions}
                </p>
                <p className="mt-2 font-display text-lg font-extrabold text-primary">
                  {formatBRL(Number(product.price))}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Button size="sm" variant={product.status === "hidden" ? "secondary" : "outline"} onClick={() => void changeVisibility(product, product.status !== "hidden")}>{product.status === "hidden" ? "Reexibir" : "Ocultar"}</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(product);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => void remove(product)}
                  >
                    <Trash2 /> Excluir
                  </Button>
                </div>
              </div>
            </article>
          ))}
          {visibleRecords.length === 0 && <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum produto encontrado com esses filtros.</p>}
        </div>
        </>
      )}
      {formOpen && (
        <ProductForm
          key={editing?.id ?? "new"}
          product={editing}
          onClose={() => setFormOpen(false)}
          onSaved={async () => {
            setFormOpen(false);
            await reload();
          }}
        />
      )}
    </section>
  );
}

function ProductForm({
  product,
  onClose,
  onSaved,
  sellerMode = false,
  sellerUserId,
}: {
  product: Tables<"products"> | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  sellerMode?: boolean;
  sellerUserId?: string;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [price, setPrice] = useState(sellerMode ? String(UNIQUE_PRICE).replace(".", ",") : String(product?.price ?? UNIQUE_PRICE).replace(".", ","));
  const [category, setCategory] = useState(product?.category ?? "cozinha");
  const [dimensions, setDimensions] = useState(product?.dimensions ?? "");
  const [maxPerCustomer, setMaxPerCustomer] = useState(
    product?.max_per_customer ? String(product.max_per_customer) : "",
  );
  const [status, setStatus] = useState(product?.status ?? "available");
  const [tags, setTags] = useState<ProductTag[]>((product?.tags ?? []) as ProductTag[]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [smartPhoto, setSmartPhoto] = useState<File | null>(null);
  const [smartPreview, setSmartPreview] = useState<string | null>(null);
  const [smartPhotoConfirmed, setSmartPhotoConfirmed] = useState(Boolean(product));
  const [processingSmartPhoto, setProcessingSmartPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState("");

  useEffect(() => {
    return () => {
      if (smartPreview) URL.revokeObjectURL(smartPreview);
    };
  }, [smartPreview]);

  async function selectSmartPhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    if (!selected.type.startsWith("image/") || selected.size > 20 * 1024 * 1024) {
      toast.error("Selecione uma imagem válida de até 20 MB.");
      return;
    }
    setProcessingSmartPhoto(true);
    try {
      const optimized = await optimizeProductImage(selected);
      setSmartPhoto(optimized);
      setFile(product ? optimized : null);
      setSmartPreview(URL.createObjectURL(optimized));
      setSmartPhotoConfirmed(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível preparar a foto.");
    } finally {
      setProcessingSmartPhoto(false);
    }
  }

  function discardSmartPhoto() {
    setSmartPhoto(null);
    setFile(null);
    setSmartPreview(null);

    if (!product) setSmartPhotoConfirmed(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const numericPrice = sellerMode ? UNIQUE_PRICE : Number(price.replace(",", "."));
    const numericLimit = maxPerCustomer.trim() === "" ? 0 : Number(maxPerCustomer);
    if (!Number.isInteger(numericLimit) || numericLimit < 0) {
      toast.error("O limite por cliente deve ser um número inteiro igual ou maior que zero");
      return;
    }
    if (
      !name.trim() ||
      !description.trim() ||
      (!sellerMode && !dimensions.trim()) ||
      !Number.isFinite(numericPrice) ||
      numericPrice < 0 ||
      (sellerMode && (!file || !sellerUserId))
    ) {
      toast.error(sellerMode ? "Preencha nome, descrição, categoria e selecione uma foto." : "Preencha nome, descrição, dimensões e um preço válido");
      return;
    }
    if (file && (file.size > 5 * 1024 * 1024 || !file.type.startsWith("image/"))) {
      toast.error("Escolha uma imagem de até 5 MB");
      return;
    }
    setBusy(true);
    const id = product?.id ?? (sellerMode ? `seller-${crypto.randomUUID()}` : productIdFromName(name));
    let imagePath = product?.image_url ?? null;
    let imageKey = product?.image_key ?? null;
    if (file) {
      let optimized: File;
      try {
        optimized = smartPhoto === file ? file : await optimizeProductImage(file);
      } catch {
        setBusy(false);
        toast.error("Não foi possível otimizar a foto. Escolha outra imagem.");
        return;
      }
      const path = `${id}/${crypto.randomUUID()}-${safeFilename(optimized.name)}`;
      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, optimized, { contentType: optimized.type });
      if (error) {
        setBusy(false);
        toast.error("Não foi possível enviar a foto");
        return;
      }
      imagePath = path;
      imageKey = null;
    }
    const payload = {
      id,
      name: name.trim(),
      description: description.trim(),
      price: numericPrice,
      category,
      dimensions: dimensions.trim(),
      status: sellerMode ? "available" : status,
      tags: sellerMode ? [] : tags,
      image_url: imagePath,
      image_key: imageKey,
      max_per_customer: sellerMode ? 0 : numericLimit,
    };
    const { error } = sellerMode
      ? await supabase.from("products").insert({ ...payload, status_aprovacao: "pendente", cadastrado_por: sellerUserId! })
      : await supabase.from("products").upsert(payload);
    setBusy(false);
    if (error) toast.error("Não foi possível salvar o produto");
    else {
      toast.success(sellerMode ? "Produto enviado com sucesso! Aguardando validação do Admin para aparecer na vitrine." : product ? "Produto atualizado" : "Produto cadastrado");
      await onSaved();
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sellerMode ? "Incluir Produto" : product ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-display text-sm font-extrabold uppercase">Foto do produto</p>
              <p className="text-xs text-muted-foreground">Tire uma foto ou escolha uma imagem da galeria. A foto será otimizada antes do envio.</p>
            </div>
            <span className="rounded-full bg-background px-3 py-1 text-[10px] font-bold text-primary">800 × 800 · WebP/JPEG</span>
          </div>
          <Button type="button" variant="cta" className="h-11 w-full" onClick={() => galleryInput.current?.click()} disabled={processingSmartPhoto || busy}>
            <Images className="size-4" /> 📸 Foto do Produto (Câmera / Galeria)
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => cameraInput.current?.click()} disabled={processingSmartPhoto || busy}>
              <Camera className="size-4" /> Tirar foto
            </Button>
            <Button type="button" variant="outline" onClick={() => galleryInput.current?.click()} disabled={processingSmartPhoto || busy}>
              <Images className="size-4" /> Escolher da galeria
            </Button>
          </div>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => void selectSmartPhoto(event)} aria-label="Tirar foto do produto com a câmera traseira" />
          <input ref={galleryInput} type="file" accept="image/*" className="sr-only" onChange={(event) => void selectSmartPhoto(event)} aria-label="Escolher foto do produto na galeria" />
          {processingSmartPhoto && (
            <div role="status" className="flex items-center gap-3 rounded-xl bg-background p-3 text-sm">
              <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
              <div className="min-w-0 flex-1 space-y-2">
                <span className="block">{photoProgress || "Otimizando imagem..."}</span>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
                </div>
              </div>
            </div>
          )}
          {smartPreview && (
            <div className="space-y-3 rounded-xl border border-border bg-background p-3">
              <div className="mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-lg border border-border bg-white">
                <img src={smartPreview} alt="Prévia da foto do produto" className="size-full object-contain" />
              </div>
              {!smartPhotoConfirmed && !product ? (
                <>
                  <p className="text-center text-sm font-bold">A foto e o recorte ficaram corretos?</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button type="button" className="bg-green-600 text-white hover:bg-green-700" onClick={() => {
                      if (smartPhoto) {
                        setFile(smartPhoto);
                        setSmartPhotoConfirmed(true);
                        toast.success("Foto selecionada. Agora preencha os dados do produto.");
                      }
                    }}>
                      SIM, USAR ESTA FOTO
                    </Button>
                    <Button type="button" variant="destructive" onClick={discardSmartPhoto}>
                      NÃO, NOVA FOTO / GALERIA
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-center text-sm font-semibold text-green-700">Foto selecionada para este produto</p>
              )}
            </div>
          )}
          {!product && !smartPhotoConfirmed && !smartPreview && !processingSmartPhoto && (
            <p className="text-center text-xs text-muted-foreground">Depois de confirmar a foto, o formulário de cadastro será liberado.</p>
          )}
        </section>
        {(sellerMode || (!product && !smartPhotoConfirmed)) ? null : (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="product-name">Nome</Label>
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="product-description">Descrição completa</Label>
            <textarea
              id="product-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-price">Preço (R$)</Label>
            <Input id="product-price" value={sellerMode ? "7,50" : price} onChange={(e) => setPrice(e.target.value)} readOnly={sellerMode} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="product-category">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="product-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!sellerMode && <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="product-dimensions">Tamanho / Dimensões</Label>
            <Input
              id="product-dimensions"
              value={dimensions}
              onChange={(e) => setDimensions(e.target.value)}
              placeholder="Ex.: Aproximadamente 20 × 15 cm"
              required
            />
          </div>}
          {!sellerMode && <div className="space-y-1.5">
            <Label htmlFor="product-limit">Limite máximo por cliente</Label>
            <Input
              id="product-limit"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={maxPerCustomer}
              onChange={(e) => setMaxPerCustomer(e.target.value)}
              placeholder="0 = sem limite"
            />
            <p className="text-xs text-muted-foreground">
              Vazio ou 0: sem limite. O histórico de pedidos não cancelados conta no limite.
            </p>
          </div>
          {!sellerMode && <div className="space-y-1.5">
            <Label htmlFor="product-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="product-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Disponível</SelectItem>
                <SelectItem value="out_of_stock">Esgotado</SelectItem>
                <SelectItem value="hidden">Oculto (fora da vitrine)</SelectItem>
              </SelectContent>
            </Select>
          </div>}
          {!sellerMode && <div className="space-y-1.5">
            <Label htmlFor="product-photo">Nova foto (até 5 MB)</Label>
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm text-muted-foreground">
              <Upload className="size-4" />
              <span className="truncate">{file?.name ?? "Escolher imagem"}</span>
              <input
                id="product-photo"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setSmartPhoto(null);
                  setSmartPreview(null);
                  setPhotoNotice(null);
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Reduzida para até 800 × 800 e comprimida automaticamente.
            </p>
          </div>
          {!sellerMode && <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">Seções da vitrine</legend>
            <div className="grid grid-cols-2 gap-3">
              {tagOptions.map((tag) => (
                <label key={tag.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={tags.includes(tag.id)}
                    onCheckedChange={(checked) =>
                      setTags((current) =>
                        checked ? [...current, tag.id] : current.filter((item) => item !== tag.id),
                      )
                    }
                  />
                  {tag.label}
                </label>
              ))}
            </div>
          </fieldset>}
          {sellerMode && <p className="sm:col-span-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Este produto será enviado para aprovação do Admin e não aparecerá na vitrine até ser aprovado.</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="cta" disabled={busy || processingSmartPhoto}>
              {busy && <Loader2 className="animate-spin" />}{" "}
              {busy ? "Enviando..." : sellerMode ? "Enviar para aprovação" : "Salvar produto"}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
