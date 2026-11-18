import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Order } from "@/lib/operations";
import { createReceiptBlob, receiptFileName } from "@/lib/receipt";
import { formatOrderNumber, whatsappLink } from "@/lib/order";
import { formatWhatsapp } from "@/lib/phone";

export function ReceiptDialog({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open) return;
    let currentUrl: string | null = null;
    setBlob(null);
    setUrl(null);
    void createReceiptBlob(order).then((created) => {
      currentUrl = URL.createObjectURL(created);
      setBlob(created);
      setUrl(currentUrl);
    }).catch(() => toast.error("Não foi possível gerar o comprovante"));
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [open, order]);

  function download() {
    if (!url) return;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = receiptFileName(order);
    anchor.click();
  }

  async function share() {
    if (!blob) return;
    const file = new File([blob], receiptFileName(order), { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `Comprovante ${formatOrderNumber(order.order_number)}` });
      return;
    }
    download();
    const message = `Olá, ${order.customer_name}! O comprovante do pedido ${formatOrderNumber(order.order_number)} foi gerado. Anexe aqui o PDF que acabou de ser baixado.`;
    window.open(whatsappLink(formatWhatsapp(order.customer_whatsapp), message), "_blank", "noopener,noreferrer");
    toast.info("PDF baixado. Anexe o arquivo na conversa do WhatsApp.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>Comprovante {formatOrderNumber(order.order_number)}</DialogTitle>
          <DialogDescription>Documento não fiscal · Pagamento Pix confirmado</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-muted">
          {url ? (
            <iframe ref={iframeRef} src={url} title="Visualização do comprovante em PDF" className="h-full w-full" />
          ) : (
            <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="outline" onClick={download} disabled={!url}><Download /> Baixar PDF</Button>
          <Button variant="outline" onClick={() => iframeRef.current?.contentWindow?.print()} disabled={!url}><Printer /> Imprimir</Button>
          <Button variant="whatsapp" onClick={() => void share()} disabled={!url}><Send /> Enviar no WhatsApp</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
