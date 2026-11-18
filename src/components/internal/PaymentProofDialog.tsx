import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getPaymentProofUrl } from "@/lib/orders.functions";
import type { Order } from "@/lib/operations";
import { formatOrderNumber } from "@/lib/order";

export function PaymentProofDialog({
  order,
  open,
  onOpenChange,
}: {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [proof, setProof] = useState<{ url: string; name: string; type: string } | null>(null);
  const [error, setError] = useState(false);
  const getProofUrl = useServerFn(getPaymentProofUrl);

  useEffect(() => {
    if (!open) return;
    setProof(null);
    setError(false);
    void getProofUrl({ data: { orderId: order.id } })
      .then(setProof)
      .catch(() => setError(true));
  }, [open, order.id, getProofUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle>Comprovante Pix · {formatOrderNumber(order.order_number)}</DialogTitle>
          <DialogDescription>
            Arquivo validado e preservado no histórico do pedido.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-xl border border-border bg-muted">
          {proof ? (
            proof.type.startsWith("image/") ? (
              <img
                src={proof.url}
                alt={`Comprovante Pix do pedido ${formatOrderNumber(order.order_number)}`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <iframe src={proof.url} title="Comprovante Pix em PDF" className="h-full w-full" />
            )
          ) : error ? (
            <p className="p-6 text-center text-sm text-destructive">
              Não foi possível abrir o comprovante. Tente novamente.
            </p>
          ) : (
            <Loader2 className="animate-spin text-primary" />
          )}
        </div>
        {proof && (
          <Button asChild variant="outline" className="w-full">
            <a href={proof.url} target="_blank" rel="noreferrer" download={proof.name}>
              <ExternalLink /> Abrir ou baixar comprovante
            </a>
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
