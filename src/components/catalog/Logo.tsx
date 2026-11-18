import logo from "@/assets/giga-shopping-logo.jpg";
import { cn } from "@/lib/utils";

export function Logo({ className, eager }: { className?: string; eager?: boolean }) {
  return (
    <img
      src={logo}
      alt="GIGA SHOPPING — Preço único R$ 7,50"
      width={965}
      height={640}
      loading={eager ? "eager" : "lazy"}
      className={cn("h-auto object-contain", className)}
    />
  );
}
