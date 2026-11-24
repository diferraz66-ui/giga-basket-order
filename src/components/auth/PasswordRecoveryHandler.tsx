import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function PasswordRecoveryHandler() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(event => {
      if (event === "PASSWORD_RECOVERY") setOpen(true);
    });
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) setOpen(true);
    return () => listener.subscription.unsubscribe();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 6 || password !== confirmation) { toast.error("Confira a senha. Ela deve ter ao menos 6 caracteres e as duas precisam ser iguais."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error("Não foi possível redefinir a senha. Solicite um novo link."); return; }
    toast.success("Senha redefinida. Você já pode entrar.");
    setOpen(false); setPassword(""); setConfirmation("");
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Definir nova senha</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-3"><div><Label htmlFor="recovery-password">Nova senha</Label><Input id="recovery-password" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required /></div><div><Label htmlFor="recovery-password-confirm">Confirmar senha</Label><Input id="recovery-password-confirm" type="password" autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} minLength={6} required /></div><Button className="w-full" type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Salvar senha</Button></form></DialogContent></Dialog>;
}
