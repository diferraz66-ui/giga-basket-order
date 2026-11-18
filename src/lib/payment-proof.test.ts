import { describe, expect, it } from "vitest";
import { hasValidProofForCurrentTotal, validatePaymentProof } from "./payment-proof";

const validAnalysis = { is_pix_receipt: true, payment_completed: true, paid_amount: 7.5 };

describe("validação do comprovante Pix", () => {
  it("aceita um comprovante Pix concluído com valor exatamente igual ao total", () => {
    expect(validatePaymentProof(validAnalysis, 7.5)).toEqual({ ok: true, amount: 7.5 });
  });

  it("rejeita uma imagem que não seja comprovante Pix", () => {
    expect(validatePaymentProof({ ...validAnalysis, is_pix_receipt: false }, 7.5)).toEqual({
      ok: false,
      reason: "Arquivo não é um comprovante Pix válido",
    });
  });

  it("rejeita valor diferente do total, inclusive por um centavo", () => {
    expect(validatePaymentProof({ ...validAnalysis, paid_amount: 7.51 }, 7.5)).toEqual({
      ok: false,
      reason: "Valor do comprovante diverge do total do pedido",
    });
  });

  it("invalida o comprovante quando o total muda depois da validação", () => {
    const proof = {
      payment_proof_path: "pedido/current",
      payment_proof_amount: 7.5,
      payment_proof_validated_at: "2026-01-01T10:00:00Z",
      payment_proof_validated_total: 7.5,
    };
    expect(hasValidProofForCurrentTotal({ ...proof, total: 7.5 })).toBe(true);
    expect(hasValidProofForCurrentTotal({ ...proof, total: 15 })).toBe(false);
  });
});
