import { useEffect, useState } from "react";
import { ShoppingBag, Store, Truck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";

const WELCOME_KEY = "giga-welcome-seen";

export function StoreWelcomeDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(WELCOME_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function close() {
    try {
      window.localStorage.setItem(WELCOME_KEY, "true");
    } catch {
      // A navegação continua mesmo se o navegador bloquear o armazenamento.
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent className="max-w-md p-6 sm:p-8">
        <DialogHeader className="items-center text-center">
          <Logo className="mb-2 w-48" />
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent text-primary">
            <ShoppingBag className="size-7" />
          </div>
          <DialogTitle className="font-display text-2xl uppercase">
            Bem-vindo à GIGA SHOPPING!
          </DialogTitle>
          <DialogDescription className="text-base font-bold text-foreground">
            Pedido mínimo de R$ 75,00.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed">
          <p className="flex gap-3 rounded-xl bg-muted p-3">
            <Truck className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              <strong>Entregas via Van para o interior</strong>
              <span className="block text-muted-foreground">Frete por conta do cliente.</span>
            </span>
          </p>
          <p className="flex gap-3 rounded-xl bg-muted p-3">
            <Store className="mt-0.5 size-5 shrink-0 text-primary" />
            <span>
              <strong>Retirada na Loja</strong>
              <span className="block text-muted-foreground">Santo Antônio de Jesus - BA.</span>
            </span>
          </p>
        </div>
        <Button variant="cta" className="h-12 w-full" onClick={close}>
          ENTENDI, VER PRODUTOS
        </Button>
      </DialogContent>
    </Dialog>
  );
}
