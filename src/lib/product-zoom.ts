export const MIN_PRODUCT_ZOOM = 1;
export const MAX_PRODUCT_ZOOM = 3;

export function clampProductZoom(scale: number) {
  return Math.min(MAX_PRODUCT_ZOOM, Math.max(MIN_PRODUCT_ZOOM, scale));
}

export function toggleProductZoom(scale: number) {
  return scale > 1 ? 1 : 2;
}