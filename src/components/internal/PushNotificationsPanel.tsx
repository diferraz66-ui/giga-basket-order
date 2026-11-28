import { useEffect, useState, type FormEvent } from "react";
import { BellRing, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export function PushNotificationsPanel() {
  const [count, setCount] = useState<number | null>(null);
  const [title, setTitle] = useState("Novidades na GIGA SHOPPING!");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("/");
  const [busy, setBusy] = useState(false);

  async function loadCount() {
    const { count: total, error } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true });
    if (error) {
      setCount(null);
      return;
    }
    setCount(total ?? 0);
  }

  useEffect(() => { void loadCount(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    const cleanUrl = url.trim() || "/";
    if (!cleanTitle || !cleanMessage) {
      toast.error("Preencha o título e a mensagem.");
      return;
    }
    if (!cleanUrl.startsWith("/") || cleanUrl.startsWith("//")) {
      toast.error("Informe um caminho interno da loja, começando com /.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: { title: cleanTitle, message: cleanMessage, url: cleanUrl },
      });
      if (error) throw error;
      const sent = Number(data?.sent ?? 0);
      const removed = Number(data?.removed ?? 0);
      toast.success(`Notificação enviada para ${sent} dispositivo(s). ${removed} assinatura(s) expirada(s) removida(s).`);
      setMessage("");
      await loadCount();
    } catch {
      toast.error("Não foi possível enviar. Confirme a Edge Function e os Secrets no Supabase.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><BellRing /></span>
          <div>
            <h2 className="font-display text-sm font-extrabold uppercase">Dispositivos inscritos</h2>
            <p className="text-xs text-muted-foreground">Navegadores que aceitaram receber alertas da GIGA.</p>
          </div>
          <strong className="ml-auto text-2xl tabular-nums">{count === null ? "—" : count}</strong>
        </div>
        {count === null && <p className="mt-3 text-xs text-muted-foreground">Não foi possível consultar as inscrições. Verifique a tabela e as políticas no Supabase.</p>}
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <h2 className="font-display text-sm font-extrabold uppercase">Enviar comunicado</h2>
          <p className="mt-1 text-xs text-muted-foreground">A mensagem será enviada a todos os dispositivos inscritos.</p>
        </div>
        <div className="space-y-1.5"><Label htmlFor="push-title">Título</Label><Input id="push-title" maxLength={80} value={title} onChange={event => setTitle(event.target.value)} required /></div>
        <div className="space-y-1.5"><Label htmlFor="push-message">Mensagem</Label><textarea id="push-message" maxLength={240} rows={4} value={message} onChange={event => setMessage(event.target.value)} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
        <div className="space-y-1.5"><Label htmlFor="push-url">Link de destino</Label><Input id="push-url" value={url} onChange={event => setUrl(event.target.value)} placeholder="/" /></div>
        <div className="flex justify-end"><Button type="submit" variant="cta" disabled={busy || !count}><Send /> {busy ? <><Loader2 className="animate-spin" /> Enviando...</> : "Enviar Notificação para Todos"}</Button></div>
      </form>
    </section>
  );
}
