export const PRODUCT_IMAGE_MAX_SIZE = 800;
export const PRODUCT_IMAGE_QUALITY = 0.82;

export function fitProductImage(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Dimensões de imagem inválidas");
  }
  const scale = Math.min(1, PRODUCT_IMAGE_MAX_SIZE / width, PRODUCT_IMAGE_MAX_SIZE / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: "image/webp" | "image/jpeg") {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, PRODUCT_IMAGE_QUALITY);
  });
}

function drawCanvas(image: HTMLImageElement, whiteBackground: boolean) {
  const size = PRODUCT_IMAGE_MAX_SIZE;
  const scale = Math.min(1, size / image.naturalWidth, size / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Este navegador não consegue otimizar a imagem");
  context.fillStyle = "white";
  context.fillRect(0, 0, size, size);
  context.drawImage(image, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
  return canvas;
}

export async function optimizeProductImage(file: File) {
  const image = await loadImage(file);
  const canvas = drawCanvas(image, false);
  let blob = await canvasToBlob(canvas, "image/webp");
  let type: "image/webp" | "image/jpeg" = "image/webp";

  if (!blob || blob.type !== "image/webp") {
    blob = await canvasToBlob(drawCanvas(image, true), "image/jpeg");
    type = "image/jpeg";
  }
  if (!blob || blob.type !== type) throw new Error("Não foi possível converter a imagem");

  const baseName = file.name.replace(/\.[^.]+$/, "") || "produto";
  const extension = type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${baseName}.${extension}`, { type, lastModified: Date.now() });
}
