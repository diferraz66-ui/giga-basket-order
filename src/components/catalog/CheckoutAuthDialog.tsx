import { useState, type FormEvent } from "react";
import { Loader2, Store, Truck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeWhatsapp, whatsappToLoginEmail } from "@/lib/phone";
import { registerCustomerFn, resetCustomerPasswordFn } from "@/lib/customer-auth.functions";
import type { DeliveryDetails } from "@/lib/order";
import { Logo } from "./Logo";

export type CheckoutIdentity = {
  userId: string;
  fullName: string;
  whatsapp: string;
};

export type CheckoutResult = {
  identity: CheckoutIdentity;
  delivery: DeliveryDetails;
};

type AuthMode = "signup" | "signin" | "recovery";


function maskWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function maskBirthDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function birthDateToISO(value: string): string | null {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return null;
  const [day = 0, month = 0, year = 0] = value.split("/").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    year < 1900 ||
    date.getTime() > Date.now()
  ) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Não foi possível concluir. Confira os dados e tente novamente.";
}


export function CheckoutAuthDialog({
  open,
  onOpenChange,
  identity,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identity: CheckoutIdentity | null;
  onComplete: (result: CheckoutResult) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [acceptsOffers, setAcceptsOffers] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"pickup" | "van" | "">("");
  const [pickupName, setPickupName] = useState("");
  const [pickupDocument, setPickupDocument] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [vanContact, setVanContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setPassword("");
    setPasswordConfirm("");
  }

  function parseDelivery(): DeliveryDetails | null {
    if (!deliveryMethod) {
      setError("Escolha retirada na loja ou despacho via Van.");
      return null;
    }
    if (deliveryMethod === "pickup") {
      if (pickupName.trim().length < 3 || pickupDocument.trim().length < 3) {
        setError("Informe o nome completo e o CPF ou RG de quem vai retirar.");
        return null;
      }
      return {
        method: "pickup",
        pickupName: pickupName.trim(),
        pickupDocument: pickupDocument.trim(),
      };
    }
    if (deliveryCity.trim().length < 2 || vanContact.trim().length < 2) {
      setError("Informe a cidade de destino e a Van ou escreva ‘A combinar’.");
      return null;
    }
    return {
      method: "van",
      deliveryCity: deliveryCity.trim(),
      vanContact: vanContact.trim(),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);

    if (mode === "recovery") {
      const phone = normalizeWhatsapp(whatsapp);
      const isoDate = birthDateToISO(birthDate);
      if (!phone) return setError("Informe um WhatsApp válido com DDD.");
      if (fullName.trim().length < 3) return setError("Informe seu nome completo.");
      if (!isoDate) return setError("Informe uma data de nascimento válida no formato DD/MM/AAAA.");
      if (password.length < 6) return setError("A nova senha precisa ter pelo menos 6 caracteres.");
      if (password !== passwordConfirm) return setError("As senhas não coincidem.");

      setBusy(true);
      try {
        const result = await resetCustomerPasswordFn({
          data: {
            whatsapp: phone,
            full_name: fullName.trim(),
            birth_date: isoDate,
            new_password: password,
          },
        });
        if (!result.success) {
          setError(result.error ?? "Não foi possível redefinir sua senha.");
          return;
        }

        const login = await supabase.auth.signInWithPassword({
          email: result.internal_email,
          password,
        });
        if (login.error) {
          setError("Sua senha foi redefinida, mas não foi possível entrar automaticamente. Volte à aba de acesso e entre com a nova senha.");
          return;
        }
        toast.success("Senha redefinida com sucesso! Você já entrou na sua conta.");
        onOpenChange(false);
      } catch (caught) {
        setError(getErrorMessage(caught));
      } finally {
        setBusy(false);
      }
      return;
    }

    const delivery = parseDelivery();
    if (!delivery) return;

    if (identity) {
      onComplete({ identity, delivery });
      return;
    }

    const phone = normalizeWhatsapp(whatsapp);
    if (!phone) return setError("Informe um WhatsApp válido com DDD.");

    if (mode === "signup") {
      const isoDate = birthDateToISO(birthDate);
      if (fullName.trim().length < 3) return setError("Informe seu nome completo.");
      if (!isoDate) return setError("Informe uma data de nascimento válida no formato DD/MM/AAAA.");
      if (password.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres.");

      setBusy(true);
      try {
        const registration = await registerCustomerFn({
          data: {
            full_name: fullName.trim(),
            whatsapp: phone,
            birth_date: isoDate,
            password,
            accepts_offers: acceptsOffers,
          },
        });
        if (!registration.success) {
          setError(registration.error ?? "Não foi possível criar seu cadastro.");
          return;
        }

        const login = await supabase.auth.signInWithPassword({
          email: registration.internal_email,
          password,
        });
        if (login.error || !login.data.user) {
          setError("Cadastro criado, mas não foi possível entrar automaticamente. Tente acessar com seu WhatsApp e senha.");
          return;
        }

        onComplete({
          identity: {
            userId: login.data.user.id,
            fullName: fullName.trim(),
            whatsapp: phone,
          },
          delivery,
        });
      } catch (caught) {
        setError(getErrorMessage(caught));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!password) return setError("Informe sua senha.");
    setBusy(true);
    try {
      const login = await supabase.auth.signInWithPassword({
        email: whatsappToLoginEmail(phone),
        password,
      });
      if (login.error) {
        setError("WhatsApp ou senha incorretos.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, whatsapp")
        .eq("id", login.data.user.id)
        .maybeSingle();
      if (profileError || !profile) {
        setError("Não foi possível carregar seu cadastro. Tente novamente.");
        return;
      }

      onComplete({
        identity: {
          userId: login.data.user.id,
          fullName: profile.full_name,
          whatsapp: profile.whatsapp,
        },
        delivery,
      });
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const isRecovery = mode === "recovery";
  const isSignup = mode === "signup";

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent className="max-h-[94vh] overflow-y-auto p-5 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <Logo className="mb-2 w-40" />
          <DialogTitle className="font-display text-xl uppercase">
            {identity
              ? "Como você quer receber?"
              : isRecovery
                ? "Recuperar acesso"
                : "Cadastro para finalizar"}
          </DialogTitle>
          <DialogDescription>
            {identity
              ? `${identity.fullName}, escolha a forma de recebimento do seu pedido.`
              : isRecovery
                ? "Confirme seus dados para cadastrar uma nova senha."
                : "Identifique-se e escolha como receber para gerar o pedido e abrir o WhatsApp da loja."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {!identity && (
            <>
              {!isRecovery && (
                <div className="grid grid-cols-2 rounded-full bg-muted p-1" role="tablist" aria-label="Acesso do cliente">
                  {(["signup", "signin"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="tab"
                      aria-selected={mode === option}
                      onClick={() => changeMode(option)}
                      className={`rounded-full px-2 py-2.5 text-sm font-bold transition-colors ${
                        mode === option
                          ? "bg-primary text-primary-foreground shadow-soft"
                          : "text-muted-foreground"
                      }`}
                    >
                      {option === "signup" ? "Criar cadastro" : "Já tenho cadastro"}
                    </button>
                  ))}
                </div>
              )}

              {(isSignup || isRecovery) && (
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-full-name">Nome completo</Label>
                  <Input
                    id="checkout-full-name"
                    name="customer_full_name"
                    autoComplete="name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Seu nome e sobrenome"
                    maxLength={120}
                    className="h-12 text-base"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="checkout-whatsapp">WhatsApp</Label>
                <Input
                  id="checkout-whatsapp"
                  type="tel"
                  inputMode="tel"
                  name="customer_whatsapp"
                  autoComplete="tel"
                  value={whatsapp}
                  onChange={(event) => setWhatsapp(maskWhatsapp(event.target.value))}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  className="h-12 text-base"
                />
              </div>

              {(isSignup || isRecovery) && (
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-birth-date">Data de nascimento</Label>
                  <Input
                    id="checkout-birth-date"
                    name="customer_birth_date"
                    inputMode="numeric"
                    autoComplete="bday"
                    value={birthDate}
                    onChange={(event) => setBirthDate(maskBirthDate(event.target.value))}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    className="h-12 text-base"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="checkout-password">{isRecovery ? "Nova senha" : "Senha"}</Label>
                <Input
                  id="checkout-password"
                  type="password"
                  name={isRecovery ? "new_password" : "customer_password"}
                  autoComplete={isRecovery || isSignup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isRecovery || isSignup ? "Mínimo de 6 caracteres" : "Sua senha"}
                  minLength={isRecovery || isSignup ? 6 : undefined}
                  className="h-12 text-base"
                />
              </div>

              {isRecovery && (
                <div className="space-y-1.5">
                  <Label htmlFor="checkout-password-confirm">Confirmar nova senha</Label>
                  <Input
                    id="checkout-password-confirm"
                    type="password"
                    name="new_password_confirmation"
                    autoComplete="new-password"
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                    placeholder="Digite novamente a nova senha"
                    minLength={6}
                    className="h-12 text-base"
                  />
                </div>
              )}

              {isSignup && (
                <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm leading-snug">
                  <Checkbox
                    id="checkout-opt-in"
                    checked={acceptsOffers}
                    onCheckedChange={(value) => setAcceptsOffers(value === true)}
                    className="mt-0.5"
                  />
                  <span>
                    Autorizo receber mensagens, novidades, promoções e ofertas da GIGA Shopping pelo
                    WhatsApp.
                    <span className="mt-1 block text-xs text-muted-foreground">Opcional.</span>
                  </span>
                </label>
              )}

              {!isRecovery && mode === "signin" && (
                <button
                  type="button"
                  className="text-sm font-medium text-primary underline"
                  onClick={() => changeMode("recovery")}
                >
                  Esqueci minha senha
                </button>
              )}

            </>
          )}

          <fieldset className="space-y-3 border-t border-border pt-4">
            <legend className="px-1 text-sm font-bold">Forma de recebimento *</legend>
            <RadioGroup
              value={deliveryMethod}
              onValueChange={(value) => {
                setDeliveryMethod(value as "pickup" | "van");
                setError(null);
              }}
              className="gap-2"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm font-bold has-checked:border-primary has-checked:bg-accent">
                <RadioGroupItem value="pickup" id="delivery-pickup" className="mt-0.5" />
                <Store className="mt-0.5 size-5 shrink-0 text-primary" />
                <span>
                  RETIRADA NA LOJA
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    Santo Antônio de Jesus - BA
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm font-bold has-checked:border-primary has-checked:bg-accent">
                <RadioGroupItem value="van" id="delivery-van" className="mt-0.5" />
                <Truck className="mt-0.5 size-5 shrink-0 text-primary" />
                <span>
                  DESPACHO VIA VAN / TRANSPORTE
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    Interior
                  </span>
                </span>
              </label>
            </RadioGroup>
          </fieldset>

          {deliveryMethod === "pickup" && (
            <div className="space-y-3 rounded-xl bg-muted p-3">
              <div className="space-y-1.5">
                <Label htmlFor="pickup-name">Nome completo de quem vai retirar *</Label>
                <Input
                  id="pickup-name"
                  value={pickupName}
                  onChange={(event) => setPickupName(event.target.value)}
                  maxLength={100}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pickup-document">CPF ou RG de quem vai retirar *</Label>
                <Input
                  id="pickup-document"
                  value={pickupDocument}
                  onChange={(event) => setPickupDocument(event.target.value)}
                  maxLength={30}
                />
              </div>
            </div>
          )}

          {deliveryMethod === "van" && (
            <div className="space-y-3 rounded-xl bg-muted p-3">
              <p className="rounded-lg bg-accent px-3 py-2 text-sm font-bold text-accent-foreground">
                ⚠️ Atenção: A despesa de retirada e transporte via Van é totalmente por conta do
                cliente.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="delivery-city">Cidade / Localidade de destino *</Label>
                <Input
                  id="delivery-city"
                  value={deliveryCity}
                  onChange={(event) => setDeliveryCity(event.target.value)}
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="van-contact">Nome / Contato da Van ou Transportador *</Label>
                <Input
                  id="van-contact"
                  value={vanContact}
                  onChange={(event) => setVanContact(event.target.value)}
                  placeholder="Se ainda não souber, escreva: A combinar"
                  maxLength={120}
                />
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground">
              {error}
            </p>
          )}

          <Button type="submit" variant="cta" className="h-12 w-full text-base" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {identity
              ? "Confirmar e finalizar pedido"
              : isRecovery
                ? "Confirmar nova senha"
                : isSignup
                  ? "Criar cadastro e finalizar"
                  : "Entrar e finalizar"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Usamos seus dados só para identificar e organizar a entrega dos seus pedidos, conforme a
          LGPD.
        </p>
      </DialogContent>
    </Dialog>
  );
}
