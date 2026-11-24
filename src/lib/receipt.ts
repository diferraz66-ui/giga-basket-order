import type { Order } from "@/lib/operations";
import { formatDateTime, orderDeliveryLines } from "@/lib/operations";
import { formatBRL, formatOrderNumber } from "@/lib/order";
import { formatWhatsapp } from "@/lib/phone";
import { hasValidProofForCurrentTotal } from "@/lib/payment-proof";

const receiptStoreLines = [
  "GIGA SHOPPING",
  "BAHIA MEGA SHOPPING IMPORTADOS LTDA",
  "CNPJ: 68.616.873/0001-67",
  "Rua Sete de Setembro, 141 - Térreo/Subsolo, Centro",
  "Santo Antônio de Jesus - BA | CEP: 44430-124",
  "WhatsApp: (75) 98178-5898",
];

const receiptSeparator = "----------------------------------------";

export function receiptFileName(order: Order) {
  return `GIGA-SHOPPING-cupom-${String(order.order_number).padStart(6, "0")}.pdf`;
}

function assertReceiptAvailable(order: Order) {
  if (order.status !== "completed" || !order.paid_at || !order.confirmed_by_name) {
    throw new Error("O comprovante só pode ser gerado após a confirmação do pagamento");
  }
  if (!hasValidProofForCurrentTotal(order)) {
    throw new Error("O cupom exige comprovante Pix validado com o valor total do pedido");
  }
}

export function buildReceiptMessage(order: Order) {
  assertReceiptAvailable(order);
  const itemLines = order.items.flatMap((item) => [
    `• ${item.quantity}x ${item.name}`,
    `  Unitário: ${formatBRL(item.price)} | Subtotal: ${formatBRL(item.price * item.quantity)}`,
  ]);
  return [
    ...receiptStoreLines,
    receiptSeparator,
    `CUPOM NÃO FISCAL - PEDIDO Nº ${formatOrderNumber(order.order_number)}`,
    "",
    `Data e Horário do pagamento: ${formatDateTime(order.paid_at)}`,
    `Referência de validação Pix: ${order.payment_proof_name?.replace(/^PIX_VALIDATED:/, "") ?? "—"}`,
    `Cliente: ${order.customer_name}`,
    `WhatsApp: ${formatWhatsapp(order.customer_whatsapp)}`,
    "",
    ...orderDeliveryLines(order),
    "",
    "Produtos:",
    ...itemLines,
    "",
    `VALOR TOTAL PAGO: ${formatBRL(Number(order.total))}`,
    "Forma de Pagamento: PIX (Comprovante Validado)",
    "Situação: PAGO",
    `Vendedor responsável: ${order.seller_name ?? "—"}`,
    `Confirmado por: ${order.confirmed_by_name}`,
    "",
    "Documento sem valor fiscal - Conferência interna GIGA Shopping.",
  ].join("\n");
}

export async function createReceiptBlob(order: Order) {
  assertReceiptAvailable(order);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 36;
  let y = 0;

  function header() {
    doc.setFillColor(217, 4, 41);
    doc.rect(0, 0, width, 180, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(receiptStoreLines[0]!, margin, 32);
    doc.setFontSize(10);
    receiptStoreLines.slice(1).forEach((line, index) => {
      doc.text(line, margin, 54 + index * 16);
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(receiptSeparator, margin, 140);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`CUPOM NÃO FISCAL - PEDIDO Nº ${formatOrderNumber(order.order_number)}`, margin, 162);
    doc.setTextColor(15, 15, 15);
    y = 204;
  }

  function footer() {
    doc.setDrawColor(210, 210, 210);
    doc.line(margin, height - 48, width - margin, height - 48);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(
      "Documento sem valor fiscal - Conferência interna GIGA Shopping.",
      width / 2,
      height - 28,
      { align: "center" },
    );
    doc.setTextColor(15, 15, 15);
  }

  header();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Data e Horário do pagamento: ${formatDateTime(order.paid_at)}`, margin, y);
  y += 22;
  doc.text(`Cliente: ${order.customer_name}`, margin, y);
  y += 18;
  doc.text(`WhatsApp: ${formatWhatsapp(order.customer_whatsapp)}`, margin, y);
  y += 22;
  for (const line of orderDeliveryLines(order)) {
    const wrapped = doc.splitTextToSize(line, width - margin * 2) as string[];
    doc.text(wrapped, margin, y);
    y += wrapped.length * 15;
  }
  y += 14;

  const productX = margin;
  const quantityX = width - 278;
  const unitX = width - 180;
  const totalX = width - margin;
  doc.setFillColor(15, 15, 15);
  doc.rect(margin, y - 16, width - margin * 2, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Produto", productX + 7, y + 3);
  doc.text("Qtd.", quantityX, y + 3);
  doc.text("Unitário", unitX, y + 3);
  doc.text("Subtotal", totalX - 7, y + 3, { align: "right" });
  doc.setTextColor(15, 15, 15);
  y += 32;

  for (const item of order.items) {
    const lines = doc.splitTextToSize(item.name, quantityX - productX - 24) as string[];
    const rowHeight = Math.max(28, lines.length * 14 + 12);
    if (y + rowHeight > height - 210) {
      footer();
      doc.addPage();
      header();
      y += 10;
    }
    doc.setFont("helvetica", "normal");
    lines.forEach((line, index) => doc.text(line, productX + 7, y + index * 14));
    doc.text(String(item.quantity), quantityX + 10, y, { align: "center" });
    doc.text(formatBRL(item.price), unitX, y);
    doc.text(formatBRL(item.price * item.quantity), totalX - 7, y, { align: "right" });
    y += rowHeight;
    doc.setDrawColor(225, 225, 225);
    doc.line(margin, y - 10, width - margin, y - 10);
  }

  if (y + 230 > height - 55) {
    footer();
    doc.addPage();
    header();
  }
  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("VALOR TOTAL PAGO", margin, y);
  doc.setTextColor(217, 4, 41);
  doc.text(formatBRL(Number(order.total)), totalX, y, { align: "right" });
  doc.setTextColor(15, 15, 15);
  y += 30;
  doc.setFontSize(11);
  doc.text("Forma de Pagamento: PIX (Comprovante Validado)", margin, y);
  y += 20;
  doc.text("Situação: PAGO", margin, y);
  y += 30;
  doc.setFont("helvetica", "normal");
  doc.text(`Vendedor responsável: ${order.seller_name ?? "—"}`, margin, y);
  y += 20;
  doc.text(`Confirmado por: ${order.confirmed_by_name}`, margin, y);
  footer();
  return doc.output("blob");
}
