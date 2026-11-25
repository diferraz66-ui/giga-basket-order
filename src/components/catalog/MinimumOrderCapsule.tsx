import { ShoppingCart } from "lucide-react";

/**
 * Cápsula compacta de "Pedido mínimo / Pagamento via Pix".
 * Substitui o banner em imagem: é texto real, nítido em qualquer tela.
 */
function PixIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156" />
    </svg>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded-full bg-primary px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase leading-tight text-primary-foreground sm:px-2.5 sm:text-xs">
      {children}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap font-display text-[8.5px] font-extrabold uppercase leading-tight tracking-tight text-ink-foreground min-[390px]:text-[9.5px] sm:text-xs">
      {children}
    </span>
  );
}

export function MinimumOrderCapsule({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex max-w-full flex-row flex-nowrap items-center justify-center gap-1 whitespace-nowrap rounded-full border border-primary/70 bg-ink/40 px-2 py-1 backdrop-blur-sm sm:min-h-9 sm:gap-2 sm:px-4 sm:py-1.5 lg:min-h-10 ${className}`}
    >
      <span className="flex shrink-0 items-center justify-center gap-1 whitespace-nowrap sm:gap-2">
        <ShoppingCart className="size-3.5 shrink-0 text-ink-foreground sm:size-4" />
        <Label>Pedido mínimo:</Label>
        <Badge>R$ 75,00 (10 itens)</Badge>
      </span>

      <span
        aria-hidden
        className="mx-1.5 h-3.5 w-px shrink-0 bg-white/30 sm:mx-3 sm:h-5"
      />

      <span className="flex max-w-full items-center justify-center gap-1.5 whitespace-nowrap sm:gap-2">
        <PixIcon className="size-3.5 shrink-0 text-pix sm:size-4" />
        <Label>Pagamento somente via</Label>
        <Badge>Pix</Badge>
      </span>
    </div>
  );
}
