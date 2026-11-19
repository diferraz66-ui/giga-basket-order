import { LogOut, Search, ShoppingCart, User } from "lucide-react";
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

export function CatalogHeader({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (q: string) => void;
}) {
  const { count, setOpen } = useCart();
  const { session, profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-ink bg-ink text-ink-foreground">
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:gap-4 sm:px-5">
        <Logo eager className="w-20 shrink-0 sm:w-28" />

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
    </header>
  );
}
