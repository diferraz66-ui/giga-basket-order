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
import { normalizeWhatsapp, whatsappToLoginEmail } from "@/lib/phone";
import { PasswordChangeDialog } from "@/components/auth/PasswordChangeDialog";
import { resetCustomerPasswordFn } from "@/lib/customer-auth.functions";
import type { Product } from "@/data/catalog";
import { ProductReviewForm } from "./ProductReviewForm";

type OrderRow = { id: string; order_number: number; created_at: string; status: string; total: number; items: unknown };
type OrderItem = { id: string; name: string; price: number; quantity: number };

function birthDateToISO(value: string): string | null {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null;
  const [day, month, year] = value.split("/").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    year < 1900 ||
    date.getTime() > Date.now()
  ) return null;
  return \${year.toString().padStart(4, "0")}-\${month.toString().padStart(2, "0")}-\${day.toString().padStart(2, "0")};
}

function maskBirthDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return \${digits.slice(0, 2)}/\${digits.slice(2)};
  return \${digits.slice(0, 2)}/\${digits.slice(2, 4)}/\${digits.slice(4)};
}

export function CustomerOrdersDialog({ open, onOpenChange, products }: { open: boolean; onOpenChange: (open: boolean) => void; products: Product[] }) {
  const { session } = useAuth();
  const { add, setOpen: openCart } = useCart();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  async function load(userId: string) {
    setLoading(true);
    const { data, error } = await supabase.from("orders").select("id, order_number, created_at, status, total, items").eq("user_id", userId).order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error("Não foi possível carregar seus pedidos."); return; }
    setOrders(data ?? []); setLoaded(true);
  }
  useEffect(() => { if (open && session?.user.id) void load(session.user.id); }, [open, session?.user.id]);
  useEffect(() => { if (!open && !session) { setLoaded(false); setOrders([]); } }, [open, session]);
  async function login() {
    const normalized = normalizeWhatsapp(identifier);
    if (!normalized || !password) { toast.error("Informe seu WhatsApp e senha."); return; }
    setLoading(true);
    const result = await supabase.auth.signInWithPassword({ email: whatsappToLoginEmail(normalized), password });
    setLoading(false);
    if (result.error) { toast.error("WhatsApp ou senha incorretos."); return; }
    await load(result.data.user.id);
  }
  async function recoverPassword() {
    const phone = normalizeWhatsapp(identifier);
    const isoDate = birthDateToISO(birthDate);
    if (!phone) { toast.error("Informe um WhatsApp válido com DDD."); return; }
    if (fullName.trim().length < 3) { toast.error("Informe seu nome completo."); return; }
    if (!isoDate) { toast.error("Informe uma data de nascimento válida no formato DD/MM/AAAA."); return; }
    if (newPassword.length < 6) { toast.error("A nova senha precisa ter pelo menos 6 caracteres."); return; }
    if (newPassword !== confirmPassword) { toast.error("As senhas não coincidem."); return; }
    setLoading(true);
    try {
      const result = await resetCustomerPasswordFn({ data: { whatsapp: phone, full_name: fullName.trim(), birth_date: isoDate, new_password: newPassword } });
      if (!result.success) { toast.error(result.error ?? "Não foi possível redefinir a senha."); return; }
      const loginResult = await supabase.auth.signInWithPassword({ email: result.internal_email, password: newPassword });
      if (loginResult.error) { toast.error("Sua senha foi redefinida, mas não foi possível entrar automaticamente."); return; }
      toast.success("Senha redefinida e acesso realizado."); setRecovery(false); await load(loginResult.data.user.id);
    } catch { toast.error("Não foi possível redefinir a senha."); }
    finally { setLoading(false); }
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
    {!session && !loaded && <div className="space-y-3"><p className="text-sm text-muted-foreground">{recovery ? "Confirme seus dados para redefinir a senha." : "Entre com seu WhatsApp e a senha cadastrada."}</p><div><Label htmlFor="orders-identifier">WhatsApp</Label><Input id="orders-identifier" type="tel" inputMode="tel" name="customer_whatsapp" autoComplete="tel" value={identifier} onChange={e=>setIdentifier(e.target.value.replace(/\D/g,"").slice(0,11).replace(/^(\d{2})(\d)/,"($1) $2").replace(/^(\(\d{2}\) \d{5})(\d)/,"$1-$2"))} placeholder="(00) 00000-0000" /></div>{recovery && <><div><Label htmlFor="orders-recovery-name">Nome completo</Label><Input id="orders-recovery-name" value={fullName} onChange={e=>setFullName(e.target.value)} /></div><div><Label htmlFor="orders-recovery-birth">Data de nascimento</Label><Input id="orders-recovery-birth" inputMode="numeric" placeholder="DD/MM/AAAA" value={birthDate} onChange={e=>setBirthDate(e.target.value.replace(/\D/g,"").slice(0,8).replace(/^(\d{2})(\d)/,"$1/$2").replace(/^(\d{2}\/\d{2})(\d)/,"$1/$2"))} /></div><div><Label htmlFor="orders-new-password">Nova senha</Label><Input id="orders-new-password" type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} /></div><div><Label htmlFor="orders-confirm-password">Confirmar senha</Label><Input id="orders-confirm-password" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} /></div></>} {!recovery && <div><Label htmlFor="orders-password">Senha</Label><Input id="orders-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} /></div>}<Button className="w-full" onClick={()=>void (recovery ? recoverPassword() : login())} disabled={loading}>{loading && <Loader2 className="animate-spin" />} {recovery ? "Redefinir senha e entrar" : "Consultar pedidos"}</Button><button type="button" className="text-sm font-medium text-primary underline" onClick={()=>setRecovery(v=>!v)}>{recovery ? "Voltar ao login" : "Esqueci minha senha"}</button></div>}
    {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>}
    {loaded && !loading && <div className="space-y-3"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={()=>setPasswordOpen(true)}>Alterar senha</Button></div>{orders.length===0 ? <p className="py-8 text-center text-sm text-muted-foreground">Você ainda não possui pedidos.</p> : orders.map(order=><article key={order.id} className="rounded-xl border border-border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-bold">Pedido {formatOrderNumber(order.order_number)}</p><p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString("pt-BR")}</p></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-bold">{statusLabel[order.status] ?? order.status}</span></div><p className="mt-2 font-display text-lg font-extrabold text-primary">{formatBRL(Number(order.total))}</p><Button size="sm" variant="outline" className="mt-2" onClick={()=>reorder(order.items)}><RotateCcw className="size-4" /> Pedir novamente</Button>{order.status === "completed" && Array.isArray(order.items) && (order.items as OrderItem[]).map(item => <div key={item.id} className="mt-3 border-t border-border pt-3"><div className="flex items-center gap-2">{products.find(product => product.id === item.id) && <img src={products.find(product => product.id === item.id)!.image} alt="" className="size-10 rounded-md bg-white object-contain p-1" />}<p className="text-sm font-semibold">{item.name}</p></div><ProductReviewForm productId={item.id} productName={item.name} orderId={order.id} /></div>)}</article>)}</div>}
  </DialogContent></Dialog><PasswordChangeDialog open={passwordOpen} onOpenChange={setPasswordOpen} /></>;
}
