import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePrimaryProductImage, resolveProductImage } from "./products";

const signing = vi.hoisted(() => ({ publicPhoto: vi.fn(), pendingPhoto: vi.fn() }));
vi.mock("./products.functions", () => ({
  getProductImageUrl: signing.publicPhoto,
  getPendingProductImageUrl: signing.pendingPhoto,
}));

const row = {
  id: "gallery-product",
  image_key: null,
  image_url: "gallery-product/main.webp",
  imagens: ["gallery-product/second.webp", "gallery-product/third.webp"],
  status_aprovacao: "aprovado",
};

describe("product gallery and single-photo consumers", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("retains all signed gallery photos while single-photo consumers get the first URL", async () => {
    const imageUrls = ["https://example.com/main.webp", "https://example.com/second.webp", "https://example.com/third.webp"];
    signing.publicPhoto.mockResolvedValue({ imageUrl: imageUrls[0], imageUrls });
    expect(await resolveProductImage(row)).toEqual(imageUrls);
    expect(await resolvePrimaryProductImage(row)).toBe("https://example.com/main.webp");
  });

  it("uses protected signing for the primary pending photo", async () => {
    signing.pendingPhoto.mockResolvedValue({ imageUrl: "https://example.com/pending.webp", imageUrls: [] });
    expect(await resolvePrimaryProductImage({ ...row, status_aprovacao: "pendente" })).toBe("https://example.com/pending.webp");
    expect(signing.publicPhoto).not.toHaveBeenCalled();
  });

  it("returns a nonempty single-photo fallback when signing is unavailable", async () => {
    signing.publicPhoto.mockRejectedValue(new Error("Unavailable"));
    const primary = await resolvePrimaryProductImage(row);
    expect(typeof primary).toBe("string");
    expect(primary.length).toBeGreaterThan(0);
  });
});