export type PaymentProofAnalysis = {
  is_pix_receipt: boolean;
  payment_completed: boolean;
  paid_amount: number | null;
};

export type PaymentProofValidation = { ok: true; amount: number } | { ok: false; reason: string };

export function toCents(value: number) {
  return Math.round((value + Number.EPSILON) * 100);
}

export function validatePaymentProof(
  analysis: PaymentProofAnalysis,
  expectedTotal: number,
): PaymentProofValidation {
  if (!analysis.is_pix_receipt || !analysis.payment_completed) {
    return { ok: false, reason: "Arquivo não é um comprovante Pix válido" };
  }
  if (
    analysis.paid_amount === null ||
    !Number.isFinite(analysis.paid_amount) ||
    analysis.paid_amount < 0
  ) {
    return { ok: false, reason: "Não foi possível identificar o valor pago no comprovante Pix" };
  }
  if (toCents(analysis.paid_amount) !== toCents(expectedTotal)) {
    return { ok: false, reason: "Valor do comprovante diverge do total do pedido" };
  }
  return { ok: true, amount: toCents(analysis.paid_amount) / 100 };
}

export function hasValidProofForCurrentTotal(order: {
  payment_proof_path: string | null;
  payment_proof_amount: number | null;
  payment_proof_validated_at: string | null;
  payment_proof_validated_total: number | null;
  total: number;
}) {
  return Boolean(
    order.payment_proof_path &&
    order.payment_proof_validated_at &&
    order.payment_proof_amount !== null &&
    order.payment_proof_validated_total !== null &&
    toCents(order.payment_proof_amount) === toCents(Number(order.total)) &&
    toCents(order.payment_proof_validated_total) === toCents(Number(order.total)),
  );
}
