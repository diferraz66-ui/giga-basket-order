import { describe, expect, it } from "vitest";
import { fitProductImage, PRODUCT_IMAGE_MAX_SIZE, PRODUCT_IMAGE_QUALITY } from "./product-image";

describe("otimização de fotos de produtos", () => {
  it("redimensiona uma foto larga para no máximo 800 pixels sem distorcer", () => {
    expect(fitProductImage(1600, 900)).toEqual({ width: 800, height: 450 });
  });

  it("redimensiona uma foto alta mantendo a proporção", () => {
    expect(fitProductImage(400, 900)).toEqual({ width: 356, height: 800 });
  });

  it("não amplia fotos que já cabem em 800 por 800", () => {
    expect(fitProductImage(600, 400)).toEqual({ width: 600, height: 400 });
  });

  it("usa o limite de 800 pixels e compressão de 82%", () => {
    expect(PRODUCT_IMAGE_MAX_SIZE).toBe(800);
    expect(PRODUCT_IMAGE_QUALITY).toBe(0.82);
  });
});
