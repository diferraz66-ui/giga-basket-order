import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AccountEmailDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setBusy(false);
    if (error) return toast.error("Não foi possível atualizar o e-mail.");
    toast.success("Enviamos uma confirmação para o novo e-mail. Confirme para ativá-lo.");
    setEmail("");
    onOpenChange(false);
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Atualizar e-mail da conta</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-3"><p className="text-sm text-muted-foreground">O novo endereço será usado para recuperação de senha. Você precisará confirmar a alteração pelo e-mail recebido.</p><div><Label htmlFor="account-new-email">Novo e-mail</Label><Input id="account-new-email" type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} required /></div><Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Enviar confirmação</Button></form></DialogContent></Dialog>;
}
