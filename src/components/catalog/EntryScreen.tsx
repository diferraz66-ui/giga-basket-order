import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { normalizeWhatsapp, whatsappToLoginEmail } from "@/lib/phone";
import { Logo } from "./Logo";

const whatsappField = z
  .string()
  .trim()
  .min(1, "Informe seu WhatsApp")
  .refine((v) => normalizeWhatsapp(v) !== null, "Informe o WhatsApp com DDD, ex: (11) 98888-7777");

const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Informe seu nome completo")
    .max(100, "Nome muito longo"),
  whatsapp: whatsappField,
  password: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres").max(72),
});

const signInSchema = z.object({
  whatsapp: whatsappField,
  password: z.string().min(1, "Informe sua senha"),
});

function maskWhatsapp(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function EntryScreen() {
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup") {
      const parsed = signUpSchema.safeParse({ fullName, whatsapp, password });
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Confira os dados informados.");
      const phone = normalizeWhatsapp(parsed.data.whatsapp)!;
      setBusy(true);
      const { data, error: err } = await supabase.auth.signUp({
        email: whatsappToLoginEmail(phone),
        password: parsed.data.password,
        options: {
          data: { full_name: parsed.data.fullName, whatsapp: phone, marketing_opt_in: optIn },
        },
      });
      setBusy(false);
      if (err) {
        if (/already|registered|exists/i.test(err.message)) {
          setMode("signin");
          return setError("Este WhatsApp já tem cadastro. Entre com sua senha.");
        }
        if (/pwned|leaked|weak/i.test(err.message)) {
          return setError("Essa senha é muito comum. Escolha outra senha.");
        }
        return setError("Não foi possível criar seu cadastro. Tente novamente.");
      }
      if (!data.session) setError("Cadastro criado! Entre com seu WhatsApp e senha.");
      return;
    }

    const parsed = signInSchema.safeParse({ whatsapp, password });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Confira os dados informados.");
    const phone = normalizeWhatsapp(parsed.data.whatsapp)!;
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: whatsappToLoginEmail(phone),
      password: parsed.data.password,
    });
    setBusy(false);
    if (err) setError("WhatsApp ou senha incorretos.");
  }

  return (
    <main className="min-h-screen bg-ink sm:px-4 sm:py-10">
      <div className="mx-auto flex min-h-screen max-w-md flex-col overflow-hidden bg-card sm:min-h-0 sm:rounded-3xl sm:shadow-soft">
        <div className="px-6 pb-6 pt-8">
          <Logo eager className="mx-auto w-64 max-w-full" />
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Catálogo digital — escolha, monte seu carrinho e peça pelo WhatsApp.
          </p>
        </div>

        <div className="flex-1 px-6 pb-10 pt-2">
          <div className="grid grid-cols-2 rounded-full bg-muted p-1" role="tablist">
            {(["signup", "signin"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`rounded-full py-2.5 text-sm font-bold transition-colors ${
                  mode === m ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground"
                }`}
              >
                {m === "signup" ? "Criar cadastro" : "Já tenho cadastro"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome e sobrenome"
                  className="h-12 text-base"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={whatsapp}
                onChange={(e) => setWhatsapp(maskWhatsapp(e.target.value))}
                placeholder="(11) 98888-7777"
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "Mínimo de 6 caracteres" : "Sua senha"}
                className="h-12 text-base"
              />
            </div>

            {mode === "signup" && (
              <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm leading-snug">
                <Checkbox
                  id="optIn"
                  checked={optIn}
                  onCheckedChange={(v) => setOptIn(v === true)}
                  className="mt-0.5"
                />
                <span>
                  Autorizo receber mensagens, novidades, promoções e ofertas da GIGA Shopping pelo
                  WhatsApp.
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
              {mode === "signup" ? "Criar cadastro e entrar" : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Usamos seus dados só para identificar seus pedidos, conforme a LGPD.
          </p>
        </div>
      </div>
    </main>
  );
}
