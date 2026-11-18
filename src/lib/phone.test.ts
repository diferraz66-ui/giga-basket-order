import { describe, expect, it } from "vitest";
import { formatWhatsapp, normalizeWhatsapp } from "./phone";

describe("WhatsApp como login", () => {
  it("aceita número com DDD e adiciona 55", () => {
    expect(normalizeWhatsapp("(11) 98888-7777")).toBe("5511988887777");
  });

  it("mantém número que já tem 55", () => {
    expect(normalizeWhatsapp("+55 11 98888-7777")).toBe("5511988887777");
  });

  it("recusa número sem DDD", () => {
    expect(normalizeWhatsapp("98888-7777")).toBeNull();
  });

  it("formata para exibição", () => {
    expect(formatWhatsapp("5511988887777")).toBe("(11) 98888-7777");
  });
});
