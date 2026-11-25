import { describe, expect, it } from "vitest";
import { clampProductZoom, toggleProductZoom } from "./product-zoom";

describe("product image zoom", () => {
  it("alternates a tap between 100% and 200%", () => {
    expect(toggleProductZoom(1)).toBe(2);
    expect(toggleProductZoom(2)).toBe(1);
  });
  it("limits pinch zoom to 1x through 3x", () => {
    expect(clampProductZoom(0.5)).toBe(1);
    expect(clampProductZoom(4)).toBe(3);
    expect(clampProductZoom(2.4)).toBe(2.4);
  });
});