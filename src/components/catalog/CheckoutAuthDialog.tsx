import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeWhatsapp, whatsappToLoginEmail } from "@/lib/phone";
import { Logo } from "./Logo";

export type CheckoutIdentity = {
  userId: string;
  fullName: string;
  whatsapp: string;
};

const whatsappField = z
  .string()
  .trim()
  .min(1, "Informe seu WhatsApp")
  .refine((value) => normalizeWhatsapp(value) !== null, "Informe o WhatsApp com DDD, ex: (11) 98888-7777");

const signUpSchema = z.object({
  fullName: z.string().trim().min(3, "Informe seu nome completo").max(100, "Nome muito longo"),
  whatsapp: whatsappField,
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres").max(72),
});

const signInSchema = z.object({
  whatsapp: whatsappField,
  password: z.string().min(1, "Informe sua senha"),
});

function maskWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function CheckoutAuthDialog({
  open,
  onOpenChange,
  onAuthenticated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: (identity: CheckoutIdentity) => void;
}) {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === "signup") {
      const parsed = signUpSchema.safeParse({ fullName, whatsapp, password });
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Confira os dados informados.");
      const phone = normalizeWhatsapp(parsed.data.whatsapp)!;
      setBusy(true);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: whatsappToLoginEmail(phone),
        password: parsed.data.password,
        options: {
          data: { full_name: parsed.data.fullName, whatsapp: phone, marketing_opt_in: optIn },
        },
      });
      setBusy(false);
      if (signUpError) {
        if (/already|registered|exists/i.test(signUpError.message)) {
          setMode("signin");
          return setError("Este WhatsApp já tem cadastro. Entre com sua senha.");
        }
        if (/pwned|leaked|weak/i.test(signUpError.message)) {
          return setError("Essa senha é muito comum. Escolha outra senha.");
        }
        return setError("Não foi possível criar seu cadastro. Tente novamente.");
      }
      if (!data.session || !data.user) {
        setMode("signin");
        return setError("Cadastro criado! Entre com seu WhatsApp e senha para finalizar.");
      }
      onAuthenticated({ userId: data.user.id, fullName: parsed.data.fullName, whatsapp: phone });
      return;
    }

    const parsed = signInSchema.safeParse({ whatsapp, password });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Confira os dados informados.");
    const phone = normalizeWhatsapp(parsed.data.whatsapp)!;
    setBusy(true);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: whatsappToLoginEmail(phone),
      password: parsed.data.password,
    });
    if (signInError) {
      setBusy(false);
      return setError("WhatsApp ou senha incorretos.");
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, whatsapp")
      .eq("id", data.user.id)
      .maybeSingle();
    setBusy(false);
    if (profileError || !profile) return setError("Não foi possível carregar seu cadastro. Tente novamente.");
    onAuthenticated({ userId: data.user.id, fullName: profile.full_name, whatsapp: profile.whatsapp });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!busy) onOpenChange(value); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-5 sm:max-w-md sm:p-6">
        <DialogHeader>
          <Logo className="mb-2 w-40" />
          <DialogTitle className="font-display text-xl uppercase">Cadastro para finalizar</DialogTitle>
          <DialogDescription>
            Identifique-se para gerar o pedido e abrir o WhatsApp da loja.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 rounded-full bg-muted p-1" role="tablist">
          {(["signup", "signin"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={mode === option}
              onClick={() => { setMode(option); setError(null); }}
              className={`rounded-full px-2 py-2.5 text-sm font-bold transition-colors ${
                mode === option ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground"
              }`}
            >
              {option === "signup" ? "Criar cadastro" : "Já tenho cadastro"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="checkout-full-name">Nome completo</Label>
              <Input
                id="checkout-full-name"
                autoComplete="name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Seu nome e sobrenome"
                className="h-12 text-base"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="checkout-whatsapp">WhatsApp</Label>
            <Input
              id="checkout-whatsapp"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={whatsapp}
              onChange={(event) => setWhatsapp(maskWhatsapp(event.target.value))}
              placeholder="(11) 98888-7777"
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="checkout-password">Senha</Label>
            <Input
              id="checkout-password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === "signup" ? "Mínimo de 6 caracteres" : "Sua senha"}
              className="h-12 text-base"
            />
          </div>

          {mode === "signup" && (
            <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm leading-snug">
              <Checkbox
                id="checkout-opt-in"
                checked={optIn}
                onCheckedChange={(value) => setOptIn(value === true)}
                className="mt-0.5"
              />
              <span>
                Autorizo receber mensagens, novidades, promoções e ofertas da GIGA Shopping pelo WhatsApp.
                <span className="mt-1 block text-xs text-muted-foreground">Opcional.</span>
              </span>
            </label>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">
              {error}
            </p>
          )}

          <Button type="submit" variant="cta" className="h-12 w-full text-base" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {mode === "signup" ? "Criar cadastro e finalizar" : "Entrar e finalizar"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Usamos seus dados só para identificar seus pedidos, conforme a LGPD.
        </p>
      </DialogContent>
    </Dialog>
  );
}
