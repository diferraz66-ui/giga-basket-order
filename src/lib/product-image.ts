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
  const { width, height } = fitProductImage(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Este navegador não consegue otimizar a imagem");
  if (whiteBackground) {
    context.fillStyle = "white";
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(image, 0, 0, width, height);
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


export type SmartProductImageResult = {
  file: File;
  backgroundRemoved: boolean;
};

function canvasBlob(canvas: HTMLCanvasElement, type: "image/webp" | "image/jpeg") {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, PRODUCT_IMAGE_QUALITY));
}

async function decodeImage(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir a foto"));
    };
    image.src = url;
  });
}

async function renderSmartSquare(source: Blob, originalName: string) {
  const image = await decodeImage(source);
  const sourceWidth = "naturalWidth" in image ? image.naturalWidth : image.width;
  const sourceHeight = "naturalHeight" in image ? image.naturalHeight : image.height;
  const sourceScale = Math.min(1, 1400 / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * sourceScale));
  const height = Math.max(1, Math.round(sourceHeight * sourceScale));
  const work = document.createElement("canvas");
  work.width = width;
  work.height = height;
  const workContext = work.getContext("2d", { willReadFrequently: true });
  if (!workContext) throw new Error("Canvas não disponível neste navegador");
  workContext.clearRect(0, 0, width, height);
  workContext.drawImage(image, 0, 0, width, height);
  if ("close" in image && typeof image.close === "function") image.close();

  const pixels = workContext.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] > 18) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    minX = 0;
    minY = 0;
    maxX = width - 1;
    maxY = height - 1;
  }

  const objectWidth = maxX - minX + 1;
  const objectHeight = maxY - minY + 1;
  const cropWidth = Math.min(width, Math.ceil(objectWidth * 1.14));
  const cropHeight = Math.min(height, Math.ceil(objectHeight * 1.14));
  const cropX = Math.max(0, Math.min(width - cropWidth, Math.round((minX + maxX + 1 - cropWidth) / 2)));
  const cropY = Math.max(0, Math.min(height - cropHeight, Math.round((minY + maxY + 1 - cropHeight) / 2)));
  const fit = Math.min(680 / cropWidth, 680 / cropHeight);
  const drawWidth = Math.max(1, Math.round(cropWidth * fit));
  const drawHeight = Math.max(1, Math.round(cropHeight * fit));

  const output = document.createElement("canvas");
  output.width = PRODUCT_IMAGE_MAX_SIZE;
  output.height = PRODUCT_IMAGE_MAX_SIZE;
  const context = output.getContext("2d");
  if (!context) throw new Error("Canvas não disponível neste navegador");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(
    work,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    Math.round((output.width - drawWidth) / 2),
    Math.round((output.height - drawHeight) / 2),
    drawWidth,
    drawHeight,
  );

  let blob = await canvasBlob(output, "image/webp");
  let type: "image/webp" | "image/jpeg" = "image/webp";
  if (!blob || blob.type !== "image/webp") {
    blob = await canvasBlob(output, "image/jpeg");
    type = "image/jpeg";
  }
  if (!blob) throw new Error("Não foi possível gerar a imagem final");
  const baseName = originalName.replace(/\\.[^.]+$/, "") || "produto";
  return new File([blob], `${baseName}-giga.${type === "image/webp" ? "webp" : "jpg"}`, {
    type,
    lastModified: Date.now(),
  });
}

/**
 * Processa a foto no próprio navegador. A rede é usada somente para carregar
 * os arquivos públicos do modelo WASM/ONNX do IMG.LY na primeira execução;
 * a imagem do produto não é enviada para nenhum serviço.
 */
export async function processSmartProductImage(
  file: File,
  onProgress?: (message: string) => void,
): Promise<SmartProductImageResult> {
  if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem");
  if (file.size > 20 * 1024 * 1024) throw new Error("A foto deve ter no máximo 20 MB");

  let foreground: Blob = file;
  let backgroundRemoved = false;
  if (typeof WebAssembly !== "undefined") {
    try {
      onProgress?.("Carregando o recorte inteligente...");
      const module = await import("@imgly/background-removal");
      const removeBackground = module.default;
      onProgress?.("Removendo fundo e ajustando enquadramento...");
      foreground = await removeBackground(file, {
        model: "small",
        output: { format: "image/png", quality: PRODUCT_IMAGE_QUALITY },
      });
      backgroundRemoved = true;
    } catch {
      // Fallback local: mantém a foto original e faz enquadramento em Canvas.
      foreground = file;
      backgroundRemoved = false;
    }
  }

  onProgress?.("Centralizando o produto em fundo branco...");
  const processed = await renderSmartSquare(foreground, file.name);
  return { file: processed, backgroundRemoved };
}
