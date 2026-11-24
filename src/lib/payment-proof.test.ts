import { describe, expect, it } from "vitest";
import { hasValidProofForCurrentTotal, validatePaymentProof } from "./payment-proof";

const validAnalysis = {
  is_pix_receipt: true,
  payment_completed: true,
  is_scheduled: false,
  visually_tampered: false,
  paid_amount: 7.5,
  transaction_id: `E${"A".repeat(31)}`,
  transaction_date: "2026-11-24",
  recipient_cnpj: "68.616.873/0001-67",
  recipient_name: "BAHIA MEGA SHOPPING IMPORTADOS LTDA",
  recipient_bank: "Itaú",
};

describe("validação antifraude do comprovante Pix", () => {
  it("aceita comprovante concluído, destinatário oficial e valor correspondente", () => {
    expect(validatePaymentProof(validAnalysis, 7.5, "2026-11-24").ok).toBe(true);
  });
  it("rejeita arquivo que não seja comprovante Pix", () => {
    expect(validatePaymentProof({ ...validAnalysis, is_pix_receipt: false }, 7.5, "2026-11-24").ok).toBe(false);
  });
  it("rejeita Pix agendado", () => {
    expect(validatePaymentProof({ ...validAnalysis, is_scheduled: true }, 7.5, "2026-11-24").ok).toBe(false);
  });
  it("rejeita sinais visuais de adulteração", () => {
    expect(validatePaymentProof({ ...validAnalysis, visually_tampered: true }, 7.5, "2026-11-24").ok).toBe(false);
  });
  it("rejeita data diferente do pedido e de hoje", () => {
    expect(validatePaymentProof({ ...validAnalysis, transaction_date: "2026-11-23" }, 7.5, "2026-11-22").ok).toBe(false);
  });
  it("rejeita destinatário incorreto", () => {
    expect(validatePaymentProof({ ...validAnalysis, recipient_cnpj: "00000000000000", recipient_name: "Outro", recipient_bank: "Banco X" }, 7.5, "2026-11-24").ok).toBe(false);
  });
  it("permite tolerância de até um centavo e rejeita acima disso", () => {
    expect(validatePaymentProof({ ...validAnalysis, paid_amount: 7.51 }, 7.5, "2026-11-24").ok).toBe(true);
    expect(validatePaymentProof({ ...validAnalysis, paid_amount: 7.52 }, 7.5, "2026-11-24").ok).toBe(false);
  });
  it("rejeita E2E inválido", () => {
    expect(validatePaymentProof({ ...validAnalysis, transaction_id: "E123" }, 7.5, "2026-11-24").ok).toBe(false);
  });
  it("invalida comprovante ativo quando o total muda", () => {
    const proof = {
      payment_proof_path: "pedido/current",
      payment_proof_amount: 7.5,
      payment_proof_validated_at: "2026-11-24T10:00:00Z",
      payment_proof_validated_total: 7.5,
      payment_proof_name: "PIX_VALIDATED:EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    };
    expect(hasValidProofForCurrentTotal({ ...proof, status: "in_progress", total: 7.5 })).toBe(true);
    expect(hasValidProofForCurrentTotal({ ...proof, status: "in_progress", total: 15 })).toBe(false);
  });
  it("preserva cupons de pedidos históricos já concluídos", () => {
    const legacy = {
      payment_proof_path: "pedido/current",
      payment_proof_amount: 7.5,
      payment_proof_validated_at: "2026-01-01T10:00:00Z",
      payment_proof_validated_total: 7.5,
      total: 7.5,
      status: "completed",
      payment_proof_name: null,
    };
    expect(hasValidProofForCurrentTotal(legacy)).toBe(true);
  });
});
