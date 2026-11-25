import { ShoppingCart } from "lucide-react";

/**
 * Cápsula compacta de "Pedido mínimo / Pagamento via Pix".
 * Substitui o banner em imagem: é texto real, nítido em qualquer tela.
 *
 * Todo o espaçamento é em `em`, então a cápsula inteira escala com a fonte,
 * que é definida por clamp() em função da largura da tela. Assim ela continua
 * em uma única linha do celular ao desktop sem cortar o carrinho nem o "PIX".
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
    <span className="whitespace-nowrap rounded-full bg-primary px-[0.55em] py-[0.22em] font-extrabold uppercase leading-tight tracking-tight text-primary-foreground sm:px-[0.8em]">
      {children}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap font-display font-extrabold uppercase leading-tight tracking-tight text-ink-foreground">
      {children}
    </span>
  );
}

export function MinimumOrderCapsule({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex max-w-full flex-row flex-nowrap items-center justify-center gap-[0.28em] whitespace-nowrap rounded-full border border-primary/70 bg-ink/40 px-[0.75em] py-[0.42em] leading-none tracking-[-0.02em] backdrop-blur-sm text-[length:clamp(6.6px,2.05vw,12px)] sm:min-h-9 sm:gap-[0.55em] sm:px-[1.2em] lg:min-h-10 ${className}`}
    >
      <span className="flex shrink-0 items-center justify-center gap-[0.28em] whitespace-nowrap sm:gap-[0.55em]">
        <ShoppingCart className="size-[1.4em] shrink-0 text-ink-foreground" />
        <Label>Pedido mínimo:</Label>
        <Badge>R$ 75,00 (10 itens)</Badge>
      </span>

      <span
        aria-hidden
        className="mx-[0.4em] h-[1.4em] w-px shrink-0 bg-white/30 sm:mx-[0.9em] sm:h-[1.6em]"
      />

      <span className="flex shrink-0 items-center justify-center gap-[0.28em] whitespace-nowrap sm:gap-[0.55em]">
        <PixIcon className="size-[1.4em] shrink-0 text-pix" />
        <Label>Pagamento somente via</Label>
        <Badge>Pix</Badge>
      </span>
    </div>
  );
}
