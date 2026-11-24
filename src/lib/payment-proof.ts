export type PaymentProofAnalysis = {
  is_pix_receipt: boolean;
  payment_completed: boolean;
  is_scheduled: boolean;
  visually_tampered: boolean;
  paid_amount: number | null;
  transaction_id: string | null;
  transaction_date: string | null;
  recipient_cnpj: string | null;
  recipient_name: string | null;
  recipient_bank: string | null;
};

export type PaymentProofValidation =
  | { ok: true; amount: number; reason: string }
  | { ok: false; reason: string };

export function toCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100);
}

export function normalizeDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

export function normalizeRecipient(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validatePaymentProof(
  analysis: PaymentProofAnalysis,
  expectedTotal: number,
  expectedDate: string,
): PaymentProofValidation {
  if (!analysis.is_pix_receipt) return { ok: false, reason: "O arquivo não foi identificado como comprovante Pix." };
  if (!analysis.payment_completed || analysis.is_scheduled) {
    return { ok: false, reason: "Pagamento não efetivado ou Pix agendado. Envie o comprovante de uma transferência concluída." };
  }
  if (analysis.visually_tampered) return { ok: false, reason: "Foram identificados sinais visuais de edição ou adulteração no comprovante." };
  const transactionId = analysis.transaction_id?.trim() ?? "";
  const isEndToEnd = /^E[A-Z0-9]{31}$/i.test(transactionId);
  const isBankAuthenticationCode = /^[A-Z0-9-]{6,64}$/i.test(transactionId);
  if (!isEndToEnd && !isBankAuthenticationCode) {
    return { ok: false, reason: "ID E2E inválido ou código de autenticação único não identificado." };
  }
  if (!analysis.transaction_date || !/^\d{4}-\d{2}-\d{2}$/.test(analysis.transaction_date)) {
    return { ok: false, reason: "Data da transação ausente ou ilegível." };
  }
  if (analysis.transaction_date !== expectedDate && analysis.transaction_date !== getBahiaDate()) {
    return { ok: false, reason: `Data divergente: comprovante de ${analysis.transaction_date}, esperado ${expectedDate} ou hoje.` };
  }
  if (analysis.paid_amount === null || !Number.isFinite(analysis.paid_amount) || analysis.paid_amount < 0) {
    return { ok: false, reason: "Não foi possível identificar o valor pago no comprovante Pix." };
  }
  if (Math.abs(toCents(analysis.paid_amount) - toCents(expectedTotal)) > 1) {
    return { ok: false, reason: "Valor do comprovante diverge do total atualizado do pedido." };
  }
  const cnpj = normalizeDigits(analysis.recipient_cnpj);
  const recipientName = normalizeRecipient(analysis.recipient_name);
  const bank = normalizeRecipient(analysis.recipient_bank);
  const hasCnpj = cnpj === "68616873000167";
  const hasOfficialName = recipientName.includes("BAHIA MEGA SHOPPING IMPORTADOS");
  const hasItau = bank.includes("ITAU");
  if (!(hasCnpj || (hasOfficialName && hasItau))) {
    return { ok: false, reason: "Destinatário divergente: CNPJ oficial ou nome empresarial com banco Itaú não confirmado." };
  }
  return { ok: true, amount: toCents(analysis.paid_amount) / 100, reason: "Comprovante aprovado pelas verificações automatizadas." };
}

export function getBahiaDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bahia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function hasValidProofForCurrentTotal(order: {
  payment_proof_path: string | null;
  payment_proof_amount: number | null;
  payment_proof_validated_at: string | null;
  payment_proof_validated_total: number | null;
  total: number;
  payment_proof_name?: string | null;
}) {
  return Boolean(
    order.payment_proof_path &&
    order.payment_proof_validated_at &&
    order.payment_proof_amount !== null &&
    order.payment_proof_validated_total !== null &&
    toCents(order.payment_proof_amount) === toCents(Number(order.total)) &&
    toCents(order.payment_proof_validated_total) === toCents(Number(order.total)) &&
    order.payment_proof_name?.startsWith("PIX_VALIDATED:")
  );
}
