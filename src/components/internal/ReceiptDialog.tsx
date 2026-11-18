import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Order } from "@/lib/operations";
import { buildReceiptMessage, createReceiptBlob, receiptFileName } from "@/lib/receipt";
import { formatOrderNumber, whatsappLink } from "@/lib/order";

export function ReceiptDialog({
  order,
  open,
  onOpenChange,
}: {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!open) return;
    let currentUrl: string | null = null;
    setUrl(null);
    void createReceiptBlob(order)
      .then((created) => {
        currentUrl = URL.createObjectURL(created);
        setUrl(currentUrl);
      })
      .catch(() => toast.error("Não foi possível gerar o cupom"));
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

  function share() {
    const message = buildReceiptMessage(order);
    window.open(whatsappLink(order.customer_whatsapp, message), "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>Cupom {formatOrderNumber(order.order_number)}</DialogTitle>
          <DialogDescription>
            Documento sem valor fiscal · PIX (Comprovante Validado)
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-muted">
          {url ? (
            <iframe
              ref={iframeRef}
              src={url}
              title="Visualização do cupom não fiscal em PDF"
              className="h-full w-full"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="animate-spin text-primary" />
            </div>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="outline" onClick={download} disabled={!url}>
            <Download /> Baixar PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => iframeRef.current?.contentWindow?.print()}
            disabled={!url}
          >
            <Printer /> Imprimir
          </Button>
          <Button
            variant="whatsapp"
            className="h-auto min-h-10 whitespace-normal py-2 text-xs leading-tight"
            onClick={share}
            disabled={!url}
          >
            <Send /> ENVIAR CUPOM NO WHATSAPP DO CLIENTE
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
