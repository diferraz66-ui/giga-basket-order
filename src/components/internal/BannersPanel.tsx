import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listAllTopBanners, uploadTopBanner, setTopBannerActive, deleteTopBanner } from "@/lib/banners.functions";

type Banner = { name: string; active: boolean; url: string };

async function optimizeBanner(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / bitmap.width, 400 / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponível");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Falha ao converter banner")), "image/webp", 0.82));
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function BannersPanel() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const listFn = useServerFn(listAllTopBanners);
  const uploadFn = useServerFn(uploadTopBanner);
  const toggleFn = useServerFn(setTopBannerActive);
  const deleteFn = useServerFn(deleteTopBanner);
  const reload = useCallback(async () => {
    try { setBanners(await listFn()); } catch { toast.error("Não foi possível carregar os banners."); }
    finally { setLoading(false); }
  }, [listFn]);
  useEffect(() => { void reload(); }, [reload]);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) return toast.error("Escolha uma imagem de até 12 MB.");
    setBusy(true);
    try {
      const base64 = await optimizeBanner(file);
      await uploadFn({ data: { base64, contentType: "image/webp" } });
      toast.success("Banner enviado e ativado.");
      await reload();
    } catch { toast.error("Não foi possível enviar o banner."); }
    finally { setBusy(false); }
  }
  async function toggle(banner: Banner) {
    setBusy(true);
    try { await toggleFn({ data: { name: banner.name, active: !banner.active } }); await reload(); }
    catch { toast.error("Não foi possível alterar o banner."); }
    finally { setBusy(false); }
  }
  async function remove(banner: Banner) {
    if (!window.confirm("Excluir este banner permanentemente?")) return;
    setBusy(true);
    try { await deleteFn({ data: { name: banner.name } }); toast.success("Banner excluído."); await reload(); }
    catch { toast.error("Não foi possível excluir o banner."); }
    finally { setBusy(false); }
  }
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin" /></div>;
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Banners do topo</h3><p className="text-xs text-muted-foreground">Imagens convertidas no navegador para WebP, até 1200 × 400 px, qualidade 82%.</p></div><label className="inline-flex cursor-pointer"><input type="file" accept="image/*" className="sr-only" onChange={event=>void upload(event)} disabled={busy} /><span className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground"><ImagePlus className="size-4" /> Adicionar banner</span></label></div>
    {busy && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Salvando alteração...</p>}
    {banners.length===0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum banner cadastrado.</p> : <div className="grid gap-3 sm:grid-cols-2">{banners.map(banner=><article key={banner.name} className="overflow-hidden rounded-xl border border-border"><img src={banner.url} alt="Banner da vitrine" className="aspect-[3/1] w-full bg-white object-contain" loading="lazy" /><div className="flex items-center justify-between gap-2 p-3"><span className={banner.active ? "text-xs font-bold text-green-700" : "text-xs font-bold text-muted-foreground"}>{banner.active ? "Ativo na vitrine" : "Desativado"}</span><div className="flex gap-1"><Button size="sm" variant="outline" disabled={busy} onClick={()=>void toggle(banner)}><Power className="size-4" /> {banner.active ? "Desativar" : "Ativar"}</Button><Button size="icon" variant="ghost" className="text-destructive" aria-label="Excluir banner" disabled={busy} onClick={()=>void remove(banner)}><Trash2 /></Button></div></div></article>)}</div>}
  </section>;
}
