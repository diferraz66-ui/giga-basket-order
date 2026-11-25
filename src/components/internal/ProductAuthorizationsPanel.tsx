import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { categoryLabel, type CategoryId } from "@/data/catalog";
import { resolveProductImage } from "@/lib/products";

type Seller = Pick<Tables<"team_members">, "user_id" | "full_name" | "username" | "active" | "pode_cadastrar_produtos">;
type PendingProduct = Tables<"products"> & { seller_name?: string };

export function ProductAuthorizationsPanel() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [pending, setPending] = useState<PendingProduct[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: members, error: membersError }, { data: products, error: productsError }] = await Promise.all([
      supabase.from("team_members").select("user_id,full_name,username,active,pode_cadastrar_produtos").order("full_name"),
      supabase.from("products").select("*").eq("status_aprovacao", "pendente").order("created_at", { ascending: true }),
    ]);
    if (membersError || productsError) {
      toast.error("Não foi possível carregar as autorizações e os produtos pendentes.");
      setLoading(false);
      return;
    }
    const sellersList = members ?? [];
    const pendingList = (products ?? []) as PendingProduct[];
    setSellers(sellersList.filter((member) => member.active));
    const sellerIds = [...new Set(pendingList.map((product) => product.cadastrado_por).filter(Boolean))] as string[];
    const { data: names } = sellerIds.length
      ? await supabase.from("team_members").select("user_id,full_name").in("user_id", sellerIds)
      : { data: [] as Array<{ user_id: string; full_name: string }> };
    const nameById = new Map((names ?? []).map((item) => [item.user_id, item.full_name]));
    const withNames = pendingList.map((product) => ({ ...product, seller_name: product.cadastrado_por ? nameById.get(product.cadastrado_por) ?? "Vendedor não identificado" : "Admin" }));
    setPending(withNames);
    const imageEntries = await Promise.all(withNames.map(async (product) => [product.id, await resolveProductImage(product)] as const));
    setImages(Object.fromEntries(imageEntries));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function togglePermission(seller: Seller, enabled: boolean) {
    setBusyId(seller.user_id);
    const { error } = await supabase.from("team_members").update({ pode_cadastrar_produtos: enabled }).eq("user_id", seller.user_id);
    setBusyId(null);
    if (error) toast.error("Não foi possível alterar a autorização.");
    else {
      toast.success(enabled ? `Cadastro liberado para ${seller.full_name}` : `Cadastro bloqueado para ${seller.full_name}`);
      setSellers((current) => current.map((item) => item.user_id === seller.user_id ? { ...item, pode_cadastrar_produtos: enabled } : item));
    }
  }

  async function approve(product: PendingProduct) {
    setBusyId(product.id);
    const { error } = await supabase.from("products").update({ status_aprovacao: "aprovado" }).eq("id", product.id).eq("status_aprovacao", "pendente");
    setBusyId(null);
    if (error) toast.error("Não foi possível aprovar o produto.");
    else { toast.success(`${product.name} aprovado e publicado`); await load(); }
  }

  async function reject(product: PendingProduct) {
    if (!window.confirm(`Recusar e excluir o produto "${product.name}"?`)) return;
    setBusyId(product.id);
    const { error } = await supabase.from("products").delete().eq("id", product.id).eq("status_aprovacao", "pendente");
    setBusyId(null);
    if (error) toast.error("Não foi possível excluir o produto pendente.");
    else {
      if (product.image_url && !/^https?:\/\//.test(product.image_url)) {
        await supabase.storage.from("product-images").remove([product.image_url]);
      }
      toast.success("Produto recusado e excluído.");
      await load();
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>;
  return <div className="space-y-8">
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-lg font-extrabold uppercase">Permissões de cadastro</h2>
      <p className="mt-1 text-sm text-muted-foreground">Ative individualmente quem pode enviar produtos novos para aprovação.</p>
      <div className="mt-4 divide-y divide-border">
        {sellers.map((seller) => <div key={seller.user_id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0"><p className="font-bold">{seller.full_name}</p><p className="text-xs text-muted-foreground">Login: {seller.username}</p><p className="text-xs text-muted-foreground">Permitir incluir novos produtos</p></div>
          <button type="button" role="switch" aria-checked={seller.pode_cadastrar_produtos} disabled={busyId === seller.user_id} onClick={() => void togglePermission(seller, !seller.pode_cadastrar_produtos)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${seller.pode_cadastrar_produtos ? "bg-green-600" : "bg-muted"} disabled:opacity-50`} aria-label={`Permitir incluir novos produtos para ${seller.full_name}`}>
            <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${seller.pode_cadastrar_produtos ? "left-6" : "left-1"}`} />
          </button>
        </div>)}
        {!sellers.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum vendedor ativo encontrado.</p>}
      </div>
    </section>
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold uppercase">Produtos Aguardando Aprovação</h2><p className="text-sm text-muted-foreground">Confira os dados antes de liberar na vitrine.</p></div><span className="rounded-full bg-primary px-3 py-1 text-sm font-extrabold text-primary-foreground">{pending.length} pendente(s)</span></div>
      <div className="grid gap-3 md:grid-cols-2">
        {pending.map((product) => <article key={product.id} className="flex gap-3 rounded-2xl border border-border bg-card p-3">
          <img src={images[product.id]} alt={product.name} className="size-24 shrink-0 rounded-xl bg-white object-contain p-1" />
          <div className="min-w-0 flex-1"><h3 className="font-bold">{product.name}</h3><p className="text-sm text-muted-foreground">{categoryLabel(product.category as CategoryId)}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><UserRound className="size-3" /> {product.seller_name}</p>
            <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="cta" disabled={busyId === product.id} onClick={() => void approve(product)}><Check className="size-4" /> Aprovar e Publicar</Button><Button size="sm" variant="outline" className="text-destructive" disabled={busyId === product.id} onClick={() => void reject(product)}><Trash2 className="size-4" /> Recusar / Excluir</Button></div>
          </div>
        </article>)}
        {!pending.length && <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum produto aguardando aprovação.</p>}
      </div>
    </section>
  </div>;
}

export function SellerProductPanel({ userId }: { userId: string }) {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from("team_members").select("pode_cadastrar_produtos,active").eq("user_id", userId).maybeSingle();
    setAllowed(!error && Boolean(data?.active && data?.pode_cadastrar_produtos));
    setLoading(false);
  }, [userId]);
  useEffect(() => { void refresh(); }, [refresh]);
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>;
  if (!allowed) return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">O cadastro de produtos não está autorizado para este usuário.</p>;
  return <section className="space-y-4">
    <div className="rounded-2xl border border-border bg-card p-4"><h2 className="text-lg font-extrabold uppercase">Incluir Produto</h2><p className="mt-1 text-sm text-muted-foreground">Cadastre um produto por vez. O preço é fixo em R$ 7,50 e cada envio passa pela validação do Admin.</p><Button variant="cta" className="mt-4" onClick={() => setOpen(true)}>Incluir Produto</Button></div>
    {open && <SellerProductForm userId={userId} onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await refresh(); }} />}
  </section>;
}

function SellerProductForm({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  return <SellerProductFormDialog userId={userId} onClose={onClose} onSaved={onSaved} />;
}

function SellerProductFormDialog({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("cozinha");
  const [dimensions, setDimensions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const camera = useState<HTMLInputElement | null>(null);
  return <SellerProductFormLegacy userId={userId} onClose={onClose} onSaved={onSaved} />;
}

function SellerProductFormLegacy({ userId, onClose, onSaved }: { userId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("cozinha");
  const [dimensions, setDimensions] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if(preview) URL.revokeObjectURL(preview); }, [preview]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if(!name.trim() || !description.trim() || !file) { toast.error("Preencha nome, descrição e selecione uma foto."); return; }
    setBusy(true);
    const id = `seller-${crypto.randomUUID()}`;
    const optimized = await optimizeProductImage(file).catch(() => null);
    if(!optimized) { setBusy(false); toast.error("Não foi possível preparar a foto."); return; }
    const path = `${id}/${crypto.randomUUID()}-${safeFilename(optimized.name)}`;
    const { error: uploadError } = await supabase.storage.from("product-images").upload(path, optimized, { contentType: optimized.type });
    if(uploadError) { setBusy(false); toast.error("Não foi possível enviar a foto."); return; }
    const { error } = await supabase.from("products").insert({ id, name:name.trim(), description:description.trim(), category, price:7.5, dimensions:dimensions.trim(), status:"available", tags:[], max_per_customer:0, image_url:path, image_key:null, status_aprovacao:"pendente", cadastrado_por:userId });
    setBusy(false);
    if(error) { await supabase.storage.from("product-images").remove([path]); toast.error("Não foi possível enviar o produto para aprovação."); return; }
    toast.success("Produto enviado com sucesso! Aguardando validação do Admin para aparecer na vitrine.");
    await onSaved();
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"><section className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-background p-5 shadow-xl">
    <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">Novo produto para aprovação</h3><Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button></div>
    <form onSubmit={(e)=>void submit(e)} className="space-y-4">
      <div><label className="mb-1 block text-sm font-medium">Nome</label><input value={name} onChange={(e)=>setName(e.target.value)} required className="w-full rounded-md border bg-background px-3 py-2" /></div>
      <div><label className="mb-1 block text-sm font-medium">Categoria</label><select value={category} onChange={(e)=>setCategory(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2">{categories.map((c)=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
      <div><label className="mb-1 block text-sm font-medium">Descrição</label><textarea value={description} onChange={(e)=>setDescription(e.target.value)} required rows={3} className="w-full rounded-md border bg-background px-3 py-2" /></div>
      <div><label className="mb-1 block text-sm font-medium">Preço</label><input value="R$ 7,50" readOnly className="w-full rounded-md border bg-muted px-3 py-2" /></div>
      <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" onClick={()=>cameraRef.current?.click()}>Tirar foto</Button><Button type="button" variant="outline" onClick={()=>galleryRef.current?.click()}>Escolher da galeria</Button></div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e)=>{const f=e.target.files?.[0];if(f){setFile(f);setPreview(URL.createObjectURL(f));}}} />
      <input ref={galleryRef} type="file" accept="image/*" className="sr-only" onChange={(e)=>{const f=e.target.files?.[0];if(f){setFile(f);setPreview(URL.createObjectURL(f));}}} />
      {preview && <img src={preview} alt="Prévia do produto" className="mx-auto max-h-64 rounded-lg object-contain" />}
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Produto enviado para aprovação. Ele não aparecerá na vitrine antes da validação do Admin.</p>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" variant="cta" disabled={busy || !file}>{busy ? <Loader2 className="animate-spin" /> : null} Enviar para aprovação</Button></div>
    </form>
  </section></div>;
}
