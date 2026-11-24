import { useEffect, useState } from "react";
import { Loader2, Package, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { formatBRL, formatOrderNumber } from "@/lib/order";
import { normalizeWhatsapp } from "@/lib/phone";
import { PasswordChangeDialog } from "@/components/auth/PasswordChangeDialog";
import { whatsappToLoginEmail } from "@/lib/phone";
import type { Product } from "@/data/catalog";

type OrderRow = { id: string; order_number: number; created_at: string; status: string; total: number; items: unknown };
type OrderItem = { id: string; name: string; price: number; quantity: number };

export function CustomerOrdersDialog({ open, onOpenChange, products }: { open: boolean; onOpenChange: (open: boolean) => void; products: Product[] }) {
  const { session } = useAuth();
  const { add, setOpen: openCart } = useCart();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  async function load(userId: string) {
    setLoading(true);
    const { data, error } = await supabase.from("orders").select("id, order_number, created_at, status, total, items").eq("user_id", userId).order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error("Não foi possível carregar seus pedidos.");
    setOrders(data ?? []); setLoaded(true);
  }
  useEffect(() => { if (open && session?.user.id) void load(session.user.id); }, [open, session?.user.id]);
  useEffect(() => { if (!open && !session) { setLoaded(false); setOrders([]); } }, [open, session]);
  async function login() {
    const value = identifier.trim();
    if (!value || !password) return toast.error("Informe seu e-mail ou WhatsApp e a senha.");
    setLoading(true);
    const normalized = value.includes("@") ? null : normalizeWhatsapp(value);
    if (!value.includes("@") && !normalized) { setLoading(false); return toast.error("Informe um WhatsApp válido com DDD."); }
    const email = value.includes("@") ? value : whatsappToLoginEmail(normalized!);
    const result = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (result.error) return toast.error("E-mail/WhatsApp ou senha incorretos.");
    await load(result.data.user.id);
  }
  function reorder(raw: unknown) {
    const items = Array.isArray(raw) ? raw as OrderItem[] : [];
    let added = 0;
    for (const item of items) {
      const product = products.find(p => p.id === item.id && p.status === "available");
      if (!product) continue;
      for (let i = 0; i < Math.min(item.quantity, 99); i++) if (add({ id: product.id, name: product.name, price: product.price, maxPerCustomer: product.maxPerCustomer })) added++;
    }
    if (added) { toast.success(`${added} unidade(s) adicionadas ao carrinho.`); onOpenChange(false); openCart(true); }
    else toast.error("Nenhum item desse pedido está disponível para compra novamente.");
  }
  const statusLabel: Record<string,string> = { received: "Recebido", in_progress: "Em atendimento", awaiting_pix: "Aguardando Pix", completed: "Concluído", cancelled: "Cancelado" };
  return <><Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="size-5" /> Meus Pedidos</DialogTitle></DialogHeader>
    {!session && !loaded && <div className="space-y-3"><p className="text-sm text-muted-foreground">Entre com seu e-mail ou WhatsApp e a senha cadastrada.</p><div><Label htmlFor="orders-identifier">E-mail ou WhatsApp</Label><Input id="orders-identifier" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder="Seu e-mail ou WhatsApp" /></div><div><Label htmlFor="orders-password">Senha</Label><Input id="orders-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} /></div><Button className="w-full" onClick={()=>void login()} disabled={loading}>{loading && <Loader2 className="animate-spin" />} Consultar pedidos</Button><button type="button" className="text-sm font-medium text-primary underline" onClick={async()=>{if(!identifier.includes("@"))return toast.error("Para recuperar a senha, informe seu e-mail.");setLoading(true);const {error}=await supabase.auth.resetPasswordForEmail(identifier.trim(),{redirectTo:window.location.origin});setLoading(false);toast.success(error?"Não foi possível enviar o link. Confira o e-mail.":"Se o e-mail estiver cadastrado, você receberá um link.");}}>Esqueci minha senha</button></div>}
    {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>}
    {loaded && !loading && <div className="space-y-3"><Button size="sm" variant="outline" onClick={()=>setPasswordOpen(true)}>Alterar senha</Button>{orders.length===0 ? <p className="py-8 text-center text-sm text-muted-foreground">Você ainda não possui pedidos.</p> : orders.map(order=><article key={order.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold">Pedido {formatOrderNumber(order.order_number)}</p><p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("pt-BR")}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{statusLabel[order.status] ?? order.status}</span></div><p className="mt-2 font-display text-lg font-extrabold text-primary">{formatBRL(Number(order.total))}</p><Button size="sm" variant="outline" className="mt-2" onClick={()=>reorder(order.items)}><RotateCcw className="size-4" /> Pedir novamente</Button></article>)}</div>}
  </DialogContent></Dialog><PasswordChangeDialog open={passwordOpen} onOpenChange={setPasswordOpen} /></>;
}
