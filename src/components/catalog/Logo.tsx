import logoAsset from "@/assets/giga-shopping-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({ className, eager }: { className?: string; eager?: boolean }) {
  return (
    <span className={cn("relative inline-block", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -inset-y-3 -z-10 bg-transparent"
      />
      <img
        src={logoAsset.url}
        alt="GIGA SHOPPING — Preço único R$ 7,50"
        width={949}
        height={632}
        loading={eager ? "eager" : "lazy"}
        className="block h-auto w-full object-contain"
      />
    </span>
  );
}
