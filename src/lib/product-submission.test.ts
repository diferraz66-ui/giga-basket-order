import { describe, expect, it } from "vitest";
import { canShowSellerForm, sellerSubmissionFields } from "./product-submission";

describe("seller submissions", () => {
  it("requires an active authorized seller", () => {
    expect(canShowSellerForm("vendedor", true, true)).toBe(true);
    expect(canShowSellerForm("vendedor", true, false)).toBe(false);
    expect(canShowSellerForm("vendedor", false, true)).toBe(false);
    expect(canShowSellerForm("admin", true, true)).toBe(false);
  });
  it("always submits a pending product attributed to its seller", () => {
    expect(sellerSubmissionFields("seller-123").status_aprovacao).toBe("pendente");
    expect(sellerSubmissionFields("seller-123").cadastrado_por).toBe("seller-123");
  });
  it("preserves the unit price until admin review", () => {
    expect(sellerSubmissionFields("seller-123").price).toBe(7.5);
  });
});