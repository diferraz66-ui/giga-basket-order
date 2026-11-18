import type { Order } from "@/lib/operations";
import { formatDateTime } from "@/lib/operations";
import { formatBRL, formatOrderNumber } from "@/lib/order";
import { formatWhatsapp } from "@/lib/phone";

export function receiptFileName(order: Order) {
  return `GIGA-SHOPPING-comprovante-${String(order.order_number).padStart(6, "0")}.pdf`;
}

export async function createReceiptBlob(order: Order) {
  if (order.status !== "completed" || !order.paid_at || !order.confirmed_by_name) {
    throw new Error("O comprovante só pode ser gerado após a confirmação do pagamento");
  }
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 44;
  let y = 0;

  function header() {
    doc.setFillColor(217, 4, 41);
    doc.rect(0, 0, width, 90, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("GIGA SHOPPING", margin, 38);
    doc.setFontSize(12);
    doc.text(`COMPROVANTE DE PEDIDO Nº ${formatOrderNumber(order.order_number)}`, margin, 64);
    doc.setTextColor(15, 15, 15);
    y = 120;
  }

  function footer() {
    doc.setDrawColor(210, 210, 210);
    doc.line(margin, height - 48, width - margin, height - 48);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text("Documento não fiscal.", width / 2, height - 28, { align: "center" });
    doc.setTextColor(15, 15, 15);
  }

  header();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Data e Horário: ${formatDateTime(order.paid_at)}`, margin, y);
  y += 22;
  doc.text(`Cliente: ${order.customer_name}`, margin, y);
  y += 18;
  doc.text(`WhatsApp: ${formatWhatsapp(order.customer_whatsapp)}`, margin, y);
  y += 34;

  const productX = margin;
  const quantityX = width - 188;
  const totalX = width - margin;
  doc.setFillColor(15, 15, 15);
  doc.rect(margin, y - 16, width - margin * 2, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Produto", productX + 8, y + 3);
  doc.text("Quantidade", quantityX, y + 3);
  doc.text("Total", totalX - 8, y + 3, { align: "right" });
  doc.setTextColor(15, 15, 15);
  y += 32;

  for (const item of order.items) {
    const lines = doc.splitTextToSize(item.name, quantityX - productX - 28) as string[];
    const rowHeight = Math.max(28, lines.length * 14 + 12);
    if (y + rowHeight > height - 210) {
      footer();
      doc.addPage();
      header();
      y += 10;
    }
    doc.setFont("helvetica", "normal");
    lines.forEach((line, index) => doc.text(line, productX + 8, y + index * 14));
    doc.text(String(item.quantity), quantityX + 24, y, { align: "center" });
    doc.text(formatBRL(item.price * item.quantity), totalX - 8, y, { align: "right" });
    y += rowHeight;
    doc.setDrawColor(225, 225, 225);
    doc.line(margin, y - 10, width - margin, y - 10);
  }

  if (y + 170 > height - 55) {
    footer();
    doc.addPage();
    header();
  }
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("TOTAL GERAL", margin, y);
  doc.setTextColor(217, 4, 41);
  doc.text(formatBRL(Number(order.total)), totalX, y, { align: "right" });
  doc.setTextColor(15, 15, 15);
  y += 30;
  doc.setFontSize(11);
  doc.text("Pagamento: PIX", margin, y);
  y += 20;
  doc.text("Situação: PAGAMENTO CONFIRMADO", margin, y);
  y += 30;
  doc.setFont("helvetica", "normal");
  doc.text(`Vendedor: ${order.seller_name ?? "—"}`, margin, y);
  y += 20;
  doc.text(`Responsável pela confirmação: ${order.confirmed_by_name}`, margin, y);
  footer();
  return doc.output("blob");
}
