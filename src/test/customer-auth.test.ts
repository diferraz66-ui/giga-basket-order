import { describe, expect, it } from "vitest";
import { normalizeName } from "@/lib/customer-auth.server";
describe("normalizeName", () => {
  it("ignora acentos, caixa e espaços duplicados", () => {
    expect(normalizeName("  José   da SILVA ")).toBe(normalizeName("jose da silva"));
  });
});
