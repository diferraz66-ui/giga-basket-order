import { useState } from "react";
import { LogOut, Search, ShoppingCart, User, ClipboardList, KeyRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { formatWhatsapp } from "@/lib/phone";
import { Logo } from "./Logo";
import { CustomerOrdersDialog } from "./CustomerOrdersDialog";
import { PasswordChangeDialog } from "@/components/auth/PasswordChangeDialog";
import type { Product } from "@/data/catalog";

export function CatalogHeader({
  query,
  onQueryChange,
  products,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  products: Product[];
}) {
  const { count, setOpen } = useCart();
  const { session, profile, signOut } = useAuth();
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <header className="relative z-50 border-b border-[#D4AF37]/30 bg-[#111827] text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:gap-4 sm:px-5">
        <Logo eager className="w-24 shrink-0 sm:w-36" />

        <label className="relative block min-w-0">
          <span className="sr-only">Buscar produtos</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar produtos..."
            className="h-11 w-full rounded-full border border-input bg-card pl-9 pr-3 text-base text-card-foreground outline-none placeholder:text-muted-foreground focus:border-primary sm:text-sm"
          />
        </label>

        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setOrdersOpen(true)} className="hidden h-10 items-center gap-1 rounded-full border border-ink-foreground/30 px-3 text-xs font-bold text-ink-foreground sm:flex"><ClipboardList className="size-4" /> Meus Pedidos</button>
          <button type="button" onClick={() => setOrdersOpen(true)} className="flex h-9 items-center gap-1 rounded-full border border-ink-foreground/30 px-2.5 text-[10px] font-bold text-ink-foreground sm:h-10 sm:px-3 sm:text-xs"><User className="size-4" /> <span className="hidden xs:inline sm:inline">{profile?.full_name ? `Olá, ${profile.full_name.split(" ")[0]}` : "Entrar / Cadastro"}</span></button>
          <button type="button" onClick={() => setOrdersOpen(true)} aria-label="Meus Pedidos" className="flex size-10 items-center justify-center rounded-full text-ink-foreground hover:bg-ink-foreground/10 sm:hidden"><ClipboardList className="size-5" /></button>
          {session && (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Minha conta"
                className="hidden size-11 items-center justify-center rounded-full text-ink-foreground hover:bg-ink-foreground/10 sm:flex"
              >
                <User className="size-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate font-bold">{profile?.full_name ?? "Cliente"}</p>
                  {profile && (
                    <p className="text-xs text-muted-foreground">
                      {formatWhatsapp(profile.whatsapp)}
                    </p>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setPasswordOpen(true)}><KeyRound className="size-4" /> Alterar senha</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void signOut()}>
                  <LogOut className="size-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <button
            onClick={() => setOpen(true)}
            aria-label={`Abrir carrinho, ${count} ${count === 1 ? "item" : "itens"}`}
            className="relative flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <ShoppingCart className="size-5" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-highlight px-1 text-[11px] font-extrabold text-highlight-foreground ring-2 ring-ink">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
    <CustomerOrdersDialog open={ordersOpen} onOpenChange={setOrdersOpen} products={products} />
      <PasswordChangeDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </header>
  );
}
