import { describe, expect, it } from "vitest";
import {
  bulkPhotoDefaults,
  parseProductCsv,
  PRODUCT_CSV_HEADERS,
  productNameFromFilename,
} from "./product-import";

describe("importação de produtos", () => {
  it("importa CSV com ponto e vírgula, preço decimal, limite e seções", () => {
    const result = parseProductCsv(
      `${PRODUCT_CSV_HEADERS.join(";")}\nBloco de anotações;Bloco com 100 folhas;7,50;Papelaria;10 x 8 cm;3;Novidades|Ofertas Especiais;Disponível\n`,
    );
    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        name: "Bloco de anotações",
        description: "Bloco com 100 folhas",
        price: 7.5,
        category: "papelaria",
        dimensions: "10 x 8 cm",
        maxPerCustomer: 3,
        tags: ["novidade", "oferta"],
        status: "available",
      },
    ]);
  });

  it("recusa limite negativo sem importar nenhuma linha", () => {
    const result = parseProductCsv(
      `${PRODUCT_CSV_HEADERS.join(";")}\nProduto;Descrição;7,50;Cozinha;10 cm;-1;;Disponível\n`,
    );
    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(["Linha 2: limite por cliente inválido"]);
  });

  it("usa o nome do arquivo e o preço padrão de R$ 7,50 no cadastro por fotos", () => {
    expect(productNameFromFilename("bloco-de-anotacoes_rosa.png")).toBe("bloco de anotacoes rosa");
    expect(bulkPhotoDefaults()).toEqual({
      price: 7.5,
      category: "novidades",
      status: "available",
      maxPerCustomer: 0,
      tags: [],
    });
  });
});
