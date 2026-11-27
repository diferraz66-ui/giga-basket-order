import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  Copy,
  FileCheck2,
  FileText,
  Loader2,
  MessageCircle,
  Minus,
  Paperclip,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  cartTotal,
  formatBRL,
  formatOrderNumber,
  isProductLimitReached,
  productLimitMessage,
  whatsappLink,
} from "@/lib/order";
import { formatWhatsapp } from "@/lib/phone";
import {
  buildPixMessage,
  formatDateTime,
  orderDeliveryLines,
  type Order,
  type OrderItem,
} from "@/lib/operations";
import { hasValidProofForCurrentTotal } from "@/lib/payment-proof";
import { manualReleasePaymentProof, uploadPaymentProof } from "@/lib/orders.functions";
import { orderStatusLabels, type OrderStatus, type StaffRole } from "@/lib/staff";

type CatalogProduct = Pick<Tables<"products">, "id" | "name" | "price" | "status" | "max_per_customer">;
type BusyAction = "status" | "items" | "proof" | "finalize" | "cancel" | null;
type TeamMemberPermissions = { active:boolean; pode_ver_todos_pedidos:boolean; pode_editar_pedidos:boolean; pode_cancelar_pedidos:boolean; pode_ignorar_pedido_minimo:boolean; pode_anexar_pix:boolean; pode_enviar_orientacoes_pix:boolean; pode_cadastrar_produtos:boolean; pode_alterar_status_produtos:boolean; pode_ver_totais_financeiros:boolean; };
const permissionDefaults: TeamMemberPermissions = { active:true, pode_ver_todos_pedidos:true, pode_editar_pedidos:true, pode_cancelar_pedidos:true, pode_ignorar_pedido_minimo:true, pode_anexar_pix:true, pode_enviar_orientacoes_pix:true, pode_cadastrar_produtos:true, pode_alterar_status_produtos:true, pode_ver_totais_financeiros:true };

export function OrderCard({
  order,
  products,
  onChanged,
  onReceipt,
  onProof,
  role,
  highlighted = false,
  permissions,
}: {
  order: Order;
  products: CatalogProduct[];
  onChanged: () => Promise<void>;
  onReceipt: (order: Order) => void;
  onProof: (order: Order) => void;
  role: StaffRole;
  highlighted?: boolean;
  permissions?: TeamMemberPermissions;
}) {
  const effectivePermissions = { ...permissionDefaults, ...permissions };
  const restrictedSeller = role === "vendedor";
  const canEdit = !restrictedSeller || effectivePermissions.pode_editar_pedidos;
  const canIgnoreMinimum = !restrictedSeller || effectivePermissions.pode_ignorar_pedido_minimo;
  const canCancel = !restrictedSeller || effectivePermissions.pode_cancelar_pedidos;
  const canAttachPix = !restrictedSeller || effectivePermissions.pode_anexar_pix;
  const canSendPixAndReceipt = !restrictedSeller || effectivePermissions.pode_enviar_orientacoes_pix;
  const active = ["received", "in_progress", "awaiting_pix"].includes(order.status);
  const [items, setItems] = useState<OrderItem[]>(order.items);
  const [query, setQuery] = useState("");
  const [purchasedQuantities, setPurchasedQuantities] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<BusyAction>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const proofPendingReason = order.payment_proof_name && !order.payment_proof_name.startsWith("PIX_VALIDATED:") ? order.payment_proof_name : null;
  const [manualReleaseOpen, setManualReleaseOpen] = useState(false);
  const [manualReleaseReason, setManualReleaseReason] = useState("");
  const [validationDetails, setValidationDetails] = useState<{ transaction_id: string | null; transaction_date: string | null; paid_amount: number | null; recipient_cnpj: string | null; recipient_name: string | null; recipient_bank: string | null } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (highlighted) {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlighted]);
  const uploadProof = useServerFn(uploadPaymentProof);
  const manualRelease = useServerFn(manualReleasePaymentProof);

  useEffect(() => {
    setItems(order.items);
    setProofError(null);
  }, [order.id, order.updated_at, order.items]);

  useEffect(() => {
    let current = true;
    setPurchasedQuantities({});
    void supabase
      .from("orders")
      .select("items")
      .eq("user_id", order.user_id)
      .neq("id", order.id)
      .neq("status", "cancelled")
      .then(({ data }) => {
        if (!current) return;
        const totals: Record<string, number> = {};
        for (const row of data ?? []) {
          if (!Array.isArray(row.items)) continue;
          for (const raw of row.items) {
            if (!raw || typeof raw !== "object") continue;
            const item = raw as { id?: unknown; quantity?: unknown };
            if (typeof item.id !== "string" || typeof item.quantity !== "number") continue;
            totals[item.id] = (totals[item.id] ?? 0) + item.quantity;
          }
        }
        setPurchasedQuantities(totals);
      });
    return () => {
      current = false;
    };
  }, [order.id, order.user_id]);

  const itemSignature = (list: OrderItem[]) =>
    JSON.stringify(list.map(({ id, quantity }) => ({ id, quantity })));
  const dirty = itemSignature(items) !== itemSignature(order.items);
  const localTotal = cartTotal(items);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const minimumOrderReached = totalQuantity >= 10 && localTotal >= 75;
  const proofValid = !dirty && hasValidProofForCurrentTotal(order);
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return [];
    return products
      .filter(
        (product) =>
          product.status === "available" &&
          product.name.toLocaleLowerCase("pt-BR").includes(normalized),
      )
      .slice(0, 5);
  }, [products, query]);

  async function copyPixKey() {
    try {
      await navigator.clipboard.writeText("68.616.873/0001-67");
      toast.success("Chave Pix copiada");
    } catch {
      toast.error("Não foi possível copiar a chave Pix");
    }
  }

  function changeQuantity(id: string, delta: number) {
    const selected = items.find((item) => item.id === id);
    if (!selected) return;
    const limit = products.find((product) => product.id === id)?.max_per_customer ?? 0;
    const totalWithHistory = selected.quantity + (purchasedQuantities[id] ?? 0);
    if (delta > 0 && isProductLimitReached(totalWithHistory, limit)) {
      toast.error(productLimitMessage(limit));
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, Math.min(99, item.quantity + delta)) }
          : item,
      ),
    );
  }

  function addProduct(product: CatalogProduct) {
    const found = items.find((item) => item.id === product.id);
    const totalWithHistory = (found?.quantity ?? 0) + (purchasedQuantities[product.id] ?? 0);
    if (isProductLimitReached(totalWithHistory, product.max_per_customer)) {
      toast.error(productLimitMessage(product.max_per_customer));
      return;
    }
    setItems((current) => {
      const currentItem = current.find((item) => item.id === product.id);
      if (currentItem)
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: Math.min(99, item.quantity + 1) } : item,
        );
      return [
        ...current,
        { id: product.id, name: product.name, price: Number(product.price), quantity: 1 },
      ];
    });
    setQuery("");
  }

  async function updateStatus(status: OrderStatus) {
    if (status === "in_progress" && !minimumOrderReached && !canIgnoreMinimum) {
      toast.error("O pedido precisa ter no mínimo 10 itens e R$ 75,00 para iniciar o atendimento.");
      return;
    }
    setBusy("status");
    const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
    setBusy(null);
    if (error) {
      toast.error("Não foi possível atualizar o atendimento");
      return;
    }
    await onChanged();
  }

  async function sendPixInstructions() {
    const popup = window.open("", "_blank");
    setBusy("status");
    const { data, error } = await supabase
      .from("orders")
      .update({ status: "awaiting_pix" })
      .eq("id", order.id)
      .select()
      .single();
    setBusy(null);
    if (error || !data) {
      popup?.close();
      toast.error("Inicie o atendimento antes de enviar as orientações do Pix");
      return;
    }
    const link = whatsappLink(
      order.customer_whatsapp,
      buildPixMessage({
        ...order,
        ...data,
        items: order.items,
        status: data.status as OrderStatus,
      }),
    );
    if (popup) popup.location.href = link;
    else toast.info("O navegador bloqueou a nova aba. Clique novamente para abrir o WhatsApp.");
    await onChanged();
  }

  async function saveItems() {
    if (!canEdit) return;
    if (!minimumOrderReached && !canIgnoreMinimum) { toast.error("Respeite o limite mínimo de compras para salvar este pedido."); return; }
    if (!dirty || items.length === 0) return;
    setBusy("items");
    const { error } = await supabase.rpc("update_order_items", {
      p_order_id: order.id,
      p_items: items.map(({ id, quantity }) => ({ id, quantity })),
    });
    setBusy(null);
    if (error) {
      toast.error(error.message || "Não foi possível salvar os itens");
      return;
    }
    toast.success(
      "Itens e total atualizados. Envie o comprovante novamente se já havia uma validação.",
    );
    await onChanged();
  }

  async function attachProof(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || dirty) return;
    setProofError(null);
    setBusy("proof");
    const form = new FormData();
    form.set("orderId", order.id);
    form.set("file", file);
    try {
      const result = await uploadProof({ data: form });
      if (!result.accepted) {
        setProofError(result.reason);
        if (result.savedForReview) await onChanged();
        return;
      }
      setValidationDetails(result.validation ?? null);
      toast.success("Comprovante Pix validado. O pedido já pode ser finalizado.");
      await onChanged();
    } catch {
      setProofError("Não foi possível validar o comprovante agora. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  async function requestManualRelease() {
    if (role !== "admin" || !order.payment_proof_path || manualReleaseReason.trim().length < 8) return;
    setBusy("proof");
    try {
      await manualRelease({ data: { orderId: order.id, reason: manualReleaseReason.trim() } });
      setManualReleaseOpen(false);
      setManualReleaseReason("");
      toast.success("Liberação manual registrada pelo Admin. O pedido pode ser finalizado.");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível liberar manualmente o pedido.");
    } finally {
      setBusy(null);
    }
  }

  async function finalize() {
    if (!minimumOrderReached && !canIgnoreMinimum) { toast.error("Respeite o limite mínimo de compras para finalizar este pedido."); return; }
    if (!proofValid) return;
    setBusy("finalize");
    const { error } = await supabase.rpc("finalize_order", { p_order_id: order.id });
    setBusy(null);
    if (error) {
      toast.error(error.message || "Não foi possível finalizar o pedido");
      return;
    }
    toast.success("Pagamento confirmado. Venda concluída!");
    await onChanged();
  }

  async function cancel() {
    if (cancelReason.trim().length < 3) return;
    setBusy("cancel");
    const { error } = await supabase.rpc("cancel_order", {
      p_order_id: order.id,
      p_reason: cancelReason.trim(),
    });
    setBusy(null);
    if (error) {
      toast.error(error.message || "Não foi possível cancelar o pedido");
      return;
    }
    setCancelOpen(false);
    setCancelReason("");
    toast.success("Pedido cancelado e movido para Finalizados");
    await onChanged();
  }

  return (
    <article ref={cardRef} className={`rounded-2xl border bg-card p-4 shadow-sm transition-all ${highlighted ? "border-primary ring-2 ring-primary/40" : "border-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-extrabold">{formatOrderNumber(order.order_number)}</h3>
            <Badge
              variant={
                order.status === "cancelled"
                  ? "destructive"
                  : order.status === "completed"
                    ? "default"
                    : "secondary"
              }
            >
              {orderStatusLabels[order.status]}
            </Badge>
          </div>
          <p className="mt-1 text-sm font-bold">
            {order.customer_name} · {formatWhatsapp(order.customer_whatsapp)}
          </p>
          <p className="text-xs text-muted-foreground">
            Recebido em {formatDateTime(order.created_at)}
          </p>
          <div className="mt-2 space-y-0.5 rounded-lg bg-muted px-3 py-2 text-xs">
            {orderDeliveryLines(order).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        <p className="font-display text-2xl font-extrabold text-primary">
          {formatBRL(active ? localTotal : Number(order.total))}
        </p>
      </div>

      {active ? (
        <>
          <div className="mt-4 space-y-2 rounded-xl bg-muted p-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-2 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
              >
                <div className="min-w-40 flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBRL(item.price)} /unidade · {formatBRL(item.price * item.quantity)}
                  </p>
                  {isProductLimitReached(
                    item.quantity + (purchasedQuantities[item.id] ?? 0),
                    products.find((product) => product.id === item.id)?.max_per_customer ?? 0,
                  ) && (
                    <p role="alert" className="mt-1 text-xs font-bold text-primary">
                      {productLimitMessage(
                        products.find((product) => product.id === item.id)?.max_per_customer ?? 0,
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-8"
                    aria-label={`Diminuir ${item.name}`}
                    disabled={item.quantity <= 1 || Boolean(busy)}
                    onClick={() => changeQuantity(item.id, -1)}
                  >
                    <Minus />
                  </Button>}
                  <span className="w-7 text-center font-bold">{item.quantity}</span>
                  {canEdit && <><Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-8"
                    aria-label={`Aumentar ${item.name}`}
                    disabled={
                      item.quantity >= 99 ||
                      isProductLimitReached(
                        item.quantity + (purchasedQuantities[item.id] ?? 0),
                        products.find((product) => product.id === item.id)?.max_per_customer ?? 0,
                      ) ||
                      Boolean(busy)
                    }
                    onClick={() => changeQuantity(item.id, 1)}
                  >
                    <Plus />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 text-destructive"
                    aria-label={`Remover ${item.name}`}
                    disabled={items.length === 1 || Boolean(busy)}
                    onClick={() =>
                      setItems((current) => current.filter(({ id }) => id !== item.id))
                    }
                  >
                    <Trash2 />
                  </Button></>}
                </div>
              </div>
            ))}
          </div>

          {canEdit && <div className="relative mt-3">
            <Label htmlFor={`search-${order.id}`} className="sr-only">
              Buscar produto para incluir
            </Label>
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              id={`search-${order.id}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar e incluir produto do catálogo"
              className="pl-9"
              disabled={Boolean(busy)}
            />
            {query.trim() && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
                {searchResults.length ? (
                  searchResults.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => addProduct(product)}
                    >
                      <span>
                        {product.name}
                        <small className="block text-muted-foreground">
                          {formatBRL(Number(product.price))} /unidade
                        </small>
                      </span>
                      <Plus className="size-4 shrink-0 text-primary" />
                    </button>
                  ))
                ) : (
                  <p className="p-3 text-sm text-muted-foreground">
                    Nenhum produto disponível encontrado.
                  </p>
                )}
              </div>
            )}
          </div>}
          {canEdit && <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            disabled={!dirty || !items.length || Boolean(busy) || (!minimumOrderReached && !canIgnoreMinimum)}
            onClick={() => void saveItems()}
          >
            {busy === "items" ? <Loader2 className="animate-spin" /> : <FileCheck2 />} SALVAR
            ALTERAÇÕES
          </Button>}

          {!minimumOrderReached && (
            <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm font-semibold text-destructive">
              ⚠️ Quantidade mínima não atingida: o pedido precisa ter no mínimo 10 itens (R$ 75,00) para iniciar o atendimento ou finalizar.
            </p>
          )}

          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="text-sm font-extrabold uppercase text-primary">PAGAMENTO SOMENTE VIA PIX</p>
            <p className="mt-2 text-sm"><strong>Chave Pix (CNPJ):</strong> 68.616.873/0001-67</p>
            <p className="text-sm"><strong>Banco:</strong> Itaú</p>
            <p className="text-sm"><strong>Favorecido:</strong> BAHIA MEGA SHOPPING IMPORTADOS LTDA (GIGA SHOPPING)</p>
            <Button type="button" size="sm" variant="outline" className="mt-3 w-full" onClick={() => void copyPixKey()}>
              <Copy /> Copiar Chave Pix
            </Button>
          </div>

          <div className="mt-4 rounded-xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold">Comprovante Pix</p>
                <p className="text-xs text-muted-foreground">JPG, PNG ou PDF · até 8 MB</p>
              </div>
              {canAttachPix && <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={dirty || Boolean(busy)}
                onClick={() => fileRef.current?.click()}
              >
                {busy === "proof" ? <Loader2 className="animate-spin" /> : <Upload />}{" "}
                {busy === "proof" ? "Validando..." : "ANEXAR COMPROVANTE PIX"}
              </Button>}
              {canAttachPix && <input
                ref={fileRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                className="sr-only"
                onChange={(event) => void attachProof(event)}
              />}
            </div>
            {dirty && (
              <p className="mt-3 text-xs font-medium text-muted-foreground">
                Salve as alterações antes de anexar o comprovante.
              </p>
            )}
            {proofError && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive"
              >
                {proofError}
              </p>
            )}
            {proofValid && (
              <div className="mt-3 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-3 text-sm">
                <p className="flex items-center gap-2 font-extrabold text-green-700 dark:text-green-300">
                  <CheckCircle2 className="size-4" /> ✅ PIX VALIDADO
                </p>
                <p className="mt-1 text-xs">Valor: {formatBRL(Number(order.payment_proof_amount))}</p>
                {order.payment_proof_name?.startsWith("PIX_VALIDATED:ADMIN_MANUAL:") ? <p className="text-xs">Validação: liberação manual do Admin</p> : <p className="text-xs">ID E2E: {order.payment_proof_name?.replace(/^PIX_VALIDATED:/, "") ?? "—"}</p>}
                {order.payment_proof_name?.startsWith("PIX_VALIDATED:ADMIN_MANUAL:") ? (
                  <p className="mt-1 text-xs font-bold text-amber-700">Liberação excepcional registrada pelo Admin</p>
                ) : validationDetails ? (
                  <div className="mt-2 space-y-0.5 text-xs">
                    <p>Data: {validationDetails.transaction_date ?? "—"}</p>
                    <p>Destinatário: {validationDetails.recipient_name ?? "—"}</p>
                    <p>CNPJ: {validationDetails.recipient_cnpj ?? "—"}</p>
                    <p>Banco: {validationDetails.recipient_bank ?? "—"}</p>
                  </div>
                ) : null}
                <button type="button" className="mt-2 text-xs font-medium underline underline-offset-2" onClick={() => onProof(order)}>Visualizar Comprovante Anexado</button>
              </div>
            )}
            {!proofValid && !dirty && order.payment_proof_path && !order.payment_proof_name?.startsWith("PIX_VALIDATED:") && (
              <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                Comprovante pendente de validação.
                {order.payment_proof_name ? ` Motivo: ${order.payment_proof_name}` : ""} {role === "admin" ? "Confira o arquivo e use a liberação manual somente após confirmar o crédito na conta." : "Aguardando revisão do Admin."}
                <button type="button" className="mt-2 block font-bold underline underline-offset-2" onClick={() => onProof(order)}>Visualizar Comprovante Anexado</button>
              </p>
            )}
            {!proofValid && !dirty && order.payment_proof_path && order.payment_proof_name?.startsWith("PIX_VALIDATED:") && !proofError && (
              <p className="mt-3 text-xs font-medium text-destructive">O total ou os itens mudaram. Envie o comprovante novamente para validar.</p>
            )}
            {role === "admin" && !proofValid && !dirty && order.payment_proof_path && (
              <Button type="button" variant="outline" className="mt-3 w-full border-amber-500 text-amber-700" disabled={Boolean(busy)} onClick={() => setManualReleaseOpen(true)}>
                Liberação manual excepcional (Admin)
              </Button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {order.status === "received" && (
              <Button
                size="sm"
                onClick={() => void updateStatus("in_progress")}
                disabled={!minimumOrderReached || Boolean(busy)}
              >
                <Play /> Iniciar atendimento
              </Button>
            )}
            {canSendPixAndReceipt && order.status === "in_progress" && (
              <Button
                size="sm"
                variant="whatsapp"
                onClick={() => void sendPixInstructions()}
                disabled={Boolean(busy)}
              >
                <MessageCircle /> Enviar orientações do Pix
              </Button>
            )}
            <Button
              size="sm"
              variant="cta"
              onClick={() => void finalize()}
              disabled={(!minimumOrderReached && !canIgnoreMinimum) || !proofValid || Boolean(busy)}
            >
              {busy === "finalize" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}{" "}
              FINALIZAR PEDIDO
            </Button>
            {canCancel && <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => setCancelOpen(true)}
              disabled={Boolean(busy)}
            >
              <XCircle /> Cancelar pedido
            </Button>}
          </div>
        </>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-border rounded-xl bg-muted px-3 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 py-2">
                <span>
                  {item.quantity}x {item.name}
                  <small className="block text-xs text-muted-foreground">
                    {formatBRL(item.price)} /unidade
                  </small>
                </span>
                <span className="shrink-0 font-bold">{formatBRL(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          {order.seller_name && (
            <p className="mt-3 text-xs text-muted-foreground">
              Vendedor: <strong>{order.seller_name}</strong>
            </p>
          )}
          {order.status === "completed" && (
            <p className="mt-1 text-xs text-muted-foreground">
              Pix confirmado por <strong>{order.confirmed_by_name}</strong> em{" "}
              {formatDateTime(order.paid_at)}
            </p>
          )}
          {order.status === "cancelled" && (
            <div className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm">
              <p className="font-bold text-destructive">
                Motivo: {order.cancellation_reason ?? "Não informado"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cancelado por {order.cancelled_by_name ?? "equipe"} em{" "}
                {formatDateTime(order.cancelled_at)}
              </p>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {order.status === "completed" && order.payment_proof_path && (
              <Button size="sm" variant="outline" onClick={() => onProof(order)}>
                <Paperclip /> Ver comprovante Pix
              </Button>
            )}
            {canSendPixAndReceipt && order.status === "completed" && (
              <Button size="sm" variant="outline" disabled={!hasValidProofForCurrentTotal(order)} onClick={() => onReceipt(order)}>
                <FileText /> Cupom não fiscal
              </Button>
            )}
          </div>
        </>
      )}

      <Dialog open={manualReleaseOpen} onOpenChange={setManualReleaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberação manual excepcional</DialogTitle>
            <DialogDescription>
              Exclusivo para Admin. Use somente após conferir o comprovante e confirmar o crédito na conta da loja. A justificativa ficará registrada no pedido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`manual-release-${order.id}`}>Justificativa obrigatória</Label>
            <Textarea
              id={`manual-release-${order.id}`}
              value={manualReleaseReason}
              onChange={(event) => setManualReleaseReason(event.target.value)}
              maxLength={240}
              placeholder="Descreva como o pagamento foi confirmado manualmente."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualReleaseOpen(false)}>Cancelar</Button>
            <Button variant="cta" disabled={manualReleaseReason.trim().length < 8 || busy === "proof"} onClick={() => void requestManualRelease()}>
              {busy === "proof" && <Loader2 className="animate-spin" />} Confirmar liberação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar {formatOrderNumber(order.order_number)}</DialogTitle>
            <DialogDescription>
              Informe um motivo curto. O pedido será movido para Finalizados e não poderá ser
              editado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`reason-${order.id}`}>Motivo do cancelamento</Label>
            <Textarea
              id={`reason-${order.id}`}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              maxLength={160}
              placeholder="Ex.: Cliente desistiu da compra"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={cancelReason.trim().length < 3 || busy === "cancel"}
              onClick={() => void cancel()}
            >
              {busy === "cancel" && <Loader2 className="animate-spin" />} Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
