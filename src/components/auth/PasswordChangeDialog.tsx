import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function PasswordChangeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 6) { toast.error("A senha precisa ter pelo menos 6 caracteres."); return; }
    if (password !== confirmation) { toast.error("As senhas não conferem."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error("Não foi possível alterar a senha."); return; }
    toast.success("Senha alterada com sucesso.");
    setPassword(""); setConfirmation(""); onOpenChange(false);
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Alterar senha</DialogTitle></DialogHeader><form onSubmit={submit} className="space-y-3"><div><Label htmlFor="new-account-password">Nova senha</Label><Input id="new-account-password" type="password" autoComplete="new-password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} required /></div><div><Label htmlFor="confirm-account-password">Confirme a nova senha</Label><Input id="confirm-account-password" type="password" autoComplete="new-password" minLength={6} value={confirmation} onChange={e=>setConfirmation(e.target.value)} required /></div><Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Salvar nova senha</Button></form></DialogContent></Dialog>;
}
