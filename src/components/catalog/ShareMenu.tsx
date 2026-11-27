import { useState } from "react";
import { Share2, Copy } from "lucide-react";
import { toast } from "sonner";

export function ShareMenu({ title, text, url, label = "Compartilhar" }: { title: string; text: string; url: string; label?: string }) {
  const [open, setOpen] = useState(false);

  async function share() {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") toast.error("Não foi possível compartilhar.");
      }
      return;
    }
    setOpen(value => !value);
  }

  const encoded = encodeURIComponent(`${text} ${url}`);
  const urlEncoded = encodeURIComponent(url);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado! Cole no Instagram, Stories ou onde preferir.");
      setOpen(false);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => void share()} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-current/25 px-3 text-xs font-semibold hover:bg-current/10 sm:h-10 sm:text-sm">
        <Share2 className="size-4" /> <span className={label === "Compartilhar" ? "hidden sm:inline" : ""}>{label}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-[80] mt-2 flex min-w-48 flex-col gap-1 rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl">
          <a role="menuitem" href={`https://api.whatsapp.com/send?text=${encoded}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-muted">WhatsApp</a>
          <a role="menuitem" href={`https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}`} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm hover:bg-muted">Facebook</a>
          <button role="menuitem" type="button" onClick={() => void copyLink()} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><Copy className="size-4"/> Instagram / Copiar link</button>
        </div>
      )}
    </div>
  );
}
