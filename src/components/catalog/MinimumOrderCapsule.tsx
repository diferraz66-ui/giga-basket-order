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
    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold uppercase leading-tight text-primary-foreground sm:px-2.5 sm:text-xs">
      {children}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-display text-[10px] font-extrabold uppercase leading-tight tracking-tight text-ink-foreground sm:text-xs">
      {children}
    </span>
  );
}

export function MinimumOrderCapsule({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex max-w-full flex-col items-center justify-center gap-1 rounded-full border border-primary/70 bg-ink/40 px-3 py-1.5 backdrop-blur-sm sm:min-h-9 sm:flex-row sm:gap-2 sm:px-4 lg:min-h-10 ${className}`}
    >
      <span className="flex max-w-full items-center justify-center gap-1.5 whitespace-nowrap sm:gap-2">
        <ShoppingCart className="size-3.5 shrink-0 text-ink-foreground sm:size-4" />
        <Label>Pedido mínimo:</Label>
        <Badge>R$ 75,00 (10 itens)</Badge>
      </span>

      <span
        aria-hidden
        className="my-0.5 h-px w-8 shrink-0 bg-ink-foreground/30 sm:mx-3 sm:my-0 sm:h-5 sm:w-px"
      />

      <span className="flex max-w-full items-center justify-center gap-1.5 whitespace-nowrap sm:gap-2">
        <PixIcon className="size-3.5 shrink-0 text-pix sm:size-4" />
        <Label>Pagamento somente via</Label>
        <Badge>Pix</Badge>
      </span>
    </div>
  );
}
