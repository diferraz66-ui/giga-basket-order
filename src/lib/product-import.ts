import { categories, UNIQUE_PRICE, type CategoryId, type ProductTag } from "@/data/catalog";

export const PRODUCT_CSV_HEADERS = [
  "Nome",
  "Descricao",
  "Preco",
  "Categoria",
  "Tamanho_Dimensoes",
  "Limite_Cliente",
  "Secao_Vitrine",
  "Status",
] as const;

export const PRODUCT_CSV_TEMPLATE = `${PRODUCT_CSV_HEADERS.join(";")}\nKit de Potes;Potes com tampa;7,50;Cozinha;5 peças;2;Ofertas Especiais|Novidades;Disponível\n`;

export type ProductImportRow = {
  name: string;
  description: string;
  price: number;
  category: CategoryId;
  dimensions: string;
  maxPerCustomer: number;
  tags: ProductTag[];
  status: "available" | "out_of_stock";
};

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function productIdFromName(name: string) {
  const slug =
    name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "produto";
  return `${slug}-${crypto.randomUUID().slice(0, 8)}`;
}

export function productNameFromFilename(filename: string) {
  return (
    filename
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Novo produto"
  );
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ";") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("O CSV contém aspas não encerradas");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function parseTags(value: string): ProductTag[] | null {
  if (!value.trim() || ["-", "nenhum", "nenhuma"].includes(value.trim().toLowerCase())) return [];
  const tags: ProductTag[] = [];
  for (const part of value.split(/[|,]/)) {
    const key = normalize(part);
    const tag: ProductTag | undefined =
      key === "oferta" || key === "ofertasespeciais"
        ? "oferta"
        : key === "maisvendido" || key === "maisvendidos"
          ? "mais-vendido"
          : key === "novidade" || key === "novidades"
            ? "novidade"
            : key === "destaque" || key === "produtosemdestaque"
              ? "destaque"
              : undefined;
    if (!tag) return null;
    if (!tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

export function parseProductCsv(text: string) {
  const matrix = parseCsvRows(text.replace(/^\uFEFF/, ""));
  if (matrix.length < 2)
    return {
      rows: [] as ProductImportRow[],
      errors: ["O CSV precisa ter o cabeçalho e pelo menos um produto"],
    };
  const headers = matrix[0]!.map((header) => header.trim());
  const missing = PRODUCT_CSV_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length)
    return { rows: [] as ProductImportRow[], errors: [`Colunas ausentes: ${missing.join(", ")}`] };

  const rows: ProductImportRow[] = [];
  const errors: string[] = [];
  for (const [rowIndex, cells] of matrix.slice(1).entries()) {
    const line = rowIndex + 2;
    const get = (header: (typeof PRODUCT_CSV_HEADERS)[number]) =>
      cells[headers.indexOf(header)]?.trim() ?? "";
    const name = get("Nome")
      .replace(/[\r\n\t\u200B]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const price = Number(
      get("Preco")
        .replace(/^R\$\s*/, "")
        .replace(",", "."),
    );
    const category = categories.find(
      (item) =>
        normalize(item.id) === normalize(get("Categoria")) ||
        normalize(item.label) === normalize(get("Categoria")),
    )?.id;
    const maxPerCustomer = get("Limite_Cliente") === "" ? 0 : Number(get("Limite_Cliente"));
    const tags = parseTags(get("Secao_Vitrine"));
    const statusKey = normalize(get("Status"));
    const status =
      statusKey === "disponivel" || statusKey === "available"
        ? "available"
        : statusKey === "esgotado" || statusKey === "outofstock"
          ? "out_of_stock"
          : null;

    if (!name) errors.push(`Linha ${line}: informe o nome`);
    if (!Number.isFinite(price) || price < 0) errors.push(`Linha ${line}: preço inválido`);
    if (!category) errors.push(`Linha ${line}: categoria inválida`);
    if (!Number.isInteger(maxPerCustomer) || maxPerCustomer < 0)
      errors.push(`Linha ${line}: limite por cliente inválido`);
    if (!tags) errors.push(`Linha ${line}: seção da vitrine inválida`);
    if (!status) errors.push(`Linha ${line}: status inválido`);
    if (
      !name ||
      !Number.isFinite(price) ||
      price < 0 ||
      !category ||
      !Number.isInteger(maxPerCustomer) ||
      maxPerCustomer < 0 ||
      !tags ||
      !status
    )
      continue;

    rows.push({
      name,
      description: get("Descricao"),
      price,
      category,
      dimensions: get("Tamanho_Dimensoes"),
      maxPerCustomer,
      tags,
      status,
    });
  }
  return { rows: errors.length ? [] : rows, errors };
}

export function bulkPhotoDefaults() {
  return {
    price: UNIQUE_PRICE,
    category: "novidades" as const,
    status: "available" as const,
    maxPerCustomer: 0,
    tags: [] as ProductTag[],
  };
}
