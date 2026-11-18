import { describe, expect, it } from "vitest";
import { categories, products, searchProducts } from "./catalog";

describe("catálogo", () => {
  it("tem as 10 categorias na ordem pedida", () => {
    expect(categories.map((c) => c.label)).toEqual([
      "Cozinha",
      "Casa e decoração",
      "Organização",
      "Beleza e cuidados pessoais",
      "Papelaria",
      "Brinquedos",
      "Ferramentas",
      "Utilidades domésticas",
      "Acessórios",
      "Novidades",
    ]);
  });

  it("tem 8 produtos de exemplo", () => {
    expect(products).toHaveLength(8);
  });

  it("todos os produtos custam o preço único de R$ 7,50", () => {
    expect(products.every((p) => p.price === 7.5)).toBe(true);
  });

  it("busca ignora acentos e maiúsculas", () => {
    expect(searchProducts(products, "HERMETICO", null).map((p) => p.id)).toEqual([
      "kit-potes-hermeticos",
    ]);
  });
});
