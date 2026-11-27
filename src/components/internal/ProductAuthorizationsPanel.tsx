import { useCallback, useEffect, useState } from "react";
import { Check, Image as ImageIcon, Loader2, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { categoryLabel, type CategoryId } from "@/data/catalog";
import { resolveProductImage } from "@/lib/products";
import { SellerProductForm, ProductAdminEditor } from "@/components/internal/ProductsPanel";
export type TeamMemberPermissions = { pode_ver_todos_pedidos: boolean; pode_editar_pedidos: boolean; pode_cancelar_pedidos: boolean; pode_ignorar_pedido_minimo: boolean; pode_anexar_pix: boolean; pode_enviar_orientacoes_pix: boolean; pode_alterar_status_produtos: boolean; pode_ver_totais_financeiros: boolean; pode_cadastrar_produtos: boolean; };
const defaultPermissions: TeamMemberPermissions = { pode_ver_todos_pedidos: true, pode_editar_pedidos: true, pode_cancelar_pedidos: true, pode_ignorar_pedido_minimo: true, pode_anexar_pix: true, pode_enviar_orientacoes_pix: true, pode_alterar_status_produtos: true, pode_ver_totais_financeiros: true, pode_cadastrar_produtos: true };
type Seller = Pick<Tables<"team_members">, "user_id" | "full_name" | "username" | "active" | "pode_cadastrar_produtos">;
type PendingProduct = Tables<"products"> & { seller_name?: string };

export function ProductAuthorizationsPanel({ permissions = defaultPermissions, role = "admin" }: { permissions?: TeamMemberPermissions; role?: "admin" | "vendedor" }) {\n  const canChangeStatus = role === "admin" || permissions.pode_alterar_status_produtos;\n  const canViewTotals = role === "admin" || permissions.pode_ver_totais_financeiros;
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [pending, setPending] = useState<PendingProduct[]>([]);
  const [images, setImages] = useState<Record<string, string[]>>({});
  const [lightbox, setLightbox] = useState<{ productName: string; url: string; index: number } | null>(null);
  const [editingProduct, setEditingProduct] = useState<PendingProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: members, error: membersError }, { data: products, error: productsError }, { data: roles, error: rolesError }] = await Promise.all([
      supabase.from("team_members").select("user_id,full_name,username,active,pode_cadastrar_produtos").order("full_name"),
      supabase.from("products").select("*").eq("status_aprovacao", "pendente").order("created_at", { ascending: true }),
      supabase.from("user_roles").select("user_id").eq("role", "vendedor"),
    ]);
    if (membersError || productsError || rolesError) {
      toast.error("Não foi possível carregar as autorizações e os produtos pendentes.");
      setLoading(false);
      return;
    }
    const sellersList = members ?? [];
    const pendingList = (products ?? []) as PendingProduct[];
    const sellerUserIds = new Set((roles ?? []).map((item) => item.user_id));
    setSellers(sellersList.filter((member) => sellerUserIds.has(member.user_id)));
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

  async function savePendingEdits() {
    setEditingProduct(null);
    await load();
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
    <section>
      <h2 className="text-lg font-extrabold uppercase">Permissões de cadastro</h2>
      <p className="mt-1 text-sm text-muted-foreground">Ative individualmente quem pode enviar produtos novos para aprovação.</p>
      <div className="mt-4 divide-y divide-border">
        {sellers.map((seller) => <div key={seller.user_id} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0"><p className="font-bold">{seller.full_name}</p><p className="text-xs text-muted-foreground">Login: {seller.username}</p><p className="text-xs text-muted-foreground">Permitir incluir novos produtos</p></div>
          <Switch checked={seller.pode_cadastrar_produtos} disabled={!seller.active || busyId === seller.user_id} onCheckedChange={(enabled) => void togglePermission(seller, enabled)} aria-label={`Permitir incluir novos produtos para ${seller.full_name}`} />
        </div>)}
        {!sellers.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum vendedor ativo encontrado.</p>}
      </div>
    </section>
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-extrabold uppercase">Produtos Aguardando Aprovação</h2><p className="text-sm text-muted-foreground">Confira os dados antes de liberar na vitrine.</p></div><span className="rounded-full bg-primary px-3 py-1 text-sm font-extrabold text-primary-foreground">{pending.length} pendente(s)</span></div>
      <div className="grid gap-3 md:grid-cols-2">
        {pending.map((product) => <article key={product.id} className="rounded-2xl border border-border bg-card p-3">
          <div className="flex flex-wrap gap-2">
            {(images[product.id] ?? []).map((url, index) => <button key={url} type="button" onClick={() => setLightbox({ productName: product.name, url, index })} className="group relative size-24 overflow-hidden rounded-xl border border-border bg-background" aria-label={`Ampliar Foto ${index + 1} de ${product.name}`}>
              <img src={url} alt={`Foto ${index + 1} de ${product.name}`} className="size-full object-contain p-1 transition-transform group-hover:scale-105" />
              <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-[10px] font-bold text-white">Foto {index + 1}</span>
            </button>)}
            {!(images[product.id]?.length) && <div className="flex size-24 items-center justify-center rounded-xl border border-dashed text-xs text-muted-foreground"><ImageIcon className="size-5" /></div>}
          </div>
          <div className="mt-3 min-w-0"><h3 className="font-bold">{product.name}</h3><p className="text-sm text-muted-foreground">{categoryLabel(product.category as CategoryId)}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><UserRound className="size-3" /> {product.seller_name}</p>
            <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busyId === product.id} onClick={() => setEditingProduct(product)}>Editar fotos e dados</Button><Button size="sm" variant="cta" disabled={busyId === product.id || !(images[product.id]?.length)} onClick={() => void approve(product)}><Check className="size-4" /> Aprovar e Publicar</Button><Button size="sm" variant="outline" className="text-destructive" disabled={busyId === product.id} onClick={() => void reject(product)}><Trash2 className="size-4" /> Recusar / Excluir</Button></div>
          </div>
        </article>)}
        {!pending.length && <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum produto aguardando aprovação.</p>}
      </div>
    </section>
    <Dialog open={lightbox !== null} onOpenChange={(open) => !open && setLightbox(null)}>
      <DialogContent className="max-h-[92vh] max-w-3xl">
        <DialogHeader><DialogTitle>{lightbox ? `${lightbox.productName} • Foto ${lightbox.index + 1}` : "Visualizar foto"}</DialogTitle></DialogHeader>
        {lightbox && <div className="flex max-h-[75vh] items-center justify-center"><img src={lightbox.url} alt={`${lightbox.productName}, foto ${lightbox.index + 1}`} className="max-h-[72vh] max-w-full object-contain" /></div>}
      </DialogContent>
    </Dialog>
    {editingProduct && <ProductAdminEditor product={editingProduct} onClose={() => setEditingProduct(null)} onSaved={savePendingEdits} />}
  </div>;
}

export function SellerProductPanel({ userId, permissions = defaultPermissions }: { userId: string; permissions?: TeamMemberPermissions }) {\n  const canSubmitProducts = permissions.pode_cadastrar_produtos;
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
  if (!allowed || !canSubmitProducts) return <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">O cadastro de produtos não está autorizado para este usuário.</p>;
  return <section className="space-y-4">
    <div className="rounded-2xl border border-border bg-card p-4"><h2 className="text-lg font-extrabold uppercase">Incluir Produto</h2><p className="mt-1 text-sm text-muted-foreground">Cadastre um produto por vez. O preço é fixo em R$ 7,50 e cada envio passa pela validação do Admin.</p><Button variant="cta" className="mt-4" onClick={() => setOpen(true)}>Incluir Produto</Button></div>
    {open && <SellerProductForm sellerUserId={userId} onClose={() => setOpen(false)} onSaved={async () => { setOpen(false); await refresh(); }} />}
  </section>;
}

