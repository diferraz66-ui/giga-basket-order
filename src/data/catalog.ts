import potes from "@/assets/produto-potes.jpg";
import luminaria from "@/assets/produto-luminaria.jpg";
import organizador from "@/assets/produto-organizador.jpg";
import pinceis from "@/assets/produto-pinceis.jpg";
import canetas from "@/assets/produto-canetas.jpg";
import cubo from "@/assets/produto-cubo.jpg";
import chaves from "@/assets/produto-chaves.jpg";
import fone from "@/assets/produto-fone.jpg";

export const store = {
  name: "GIGA SHOPPING",
  whatsapp: "5575981785898",
};

export const UNIQUE_PRICE = 7.5;

export const categories = [
  { id: "cozinha", label: "Cozinha" },
  { id: "casa-decoracao", label: "Casa e decoração" },
  { id: "organizacao", label: "Organização" },
  { id: "beleza", label: "Beleza e cuidados pessoais" },
  { id: "papelaria", label: "Papelaria" },
  { id: "brinquedos", label: "Brinquedos" },
  { id: "ferramentas", label: "Ferramentas" },
  { id: "utilidades", label: "Utilidades domésticas" },
  { id: "acessorios", label: "Acessórios" },
  { id: "novidades", label: "Novidades" },
] as const;

export type CategoryId = (typeof categories)[number]["id"];
export type ProductTag = "oferta" | "mais-vendido" | "novidade" | "destaque";

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  imageKey?: string | null;
  imagePath?: string | null;
  images?: string[];
  dimensions: string;
  status: "available" | "out_of_stock" | "hidden";
  maxPerCustomer: number;
  category: CategoryId;
  tags: ProductTag[];
};

export const products: Product[] = [
  {
    id: "kit-potes-hermeticos",
    name: "Kit 5 Potes Herméticos",
    description: "Tampas com vedação, vão ao micro-ondas e à geladeira.",
    price: UNIQUE_PRICE,
    image: potes,
    imageKey: "potes",
    dimensions: "5 peças: 250 ml, 400 ml, 650 ml, 1 L e 1,5 L",
    status: "available",
    maxPerCustomer: 0,
    category: "cozinha",
    tags: ["oferta", "mais-vendido"],
  },
  {
    id: "luminaria-led-mesa",
    name: "Luminária LED de Mesa",
    description: "Luz quente com toque, cabeça giratória e cabo USB.",
    price: UNIQUE_PRICE,
    image: luminaria,
    imageKey: "luminaria",
    dimensions: "Altura aproximada de 35 cm; cabo USB de 1 m",
    status: "available",
    maxPerCustomer: 0,
    category: "casa-decoracao",
    tags: ["destaque"],
  },
  {
    id: "organizador-acrilico",
    name: "Organizador Acrílico 4 Gavetas",
    description: "Ideal para maquiagem, bijuterias e escritório.",
    price: UNIQUE_PRICE,
    image: organizador,
    imageKey: "organizador",
    dimensions: "Aproximadamente 24 × 15 × 18 cm",
    status: "available",
    maxPerCustomer: 0,
    category: "organizacao",
    tags: ["oferta", "destaque"],
  },
  {
    id: "kit-pinceis-maquiagem",
    name: "Kit 9 Pincéis de Maquiagem",
    description: "Cerdas macias com porta-pincéis incluso.",
    price: UNIQUE_PRICE,
    image: pinceis,
    imageKey: "pinceis",
    dimensions: "9 pincéis com cabos de aproximadamente 12 a 15 cm",
    status: "available",
    maxPerCustomer: 0,
    category: "beleza",
    tags: ["mais-vendido"],
  },
  {
    id: "canetas-gel-caderno",
    name: "Kit 12 Canetas Gel + Caderno",
    description: "Cores vibrantes, ponta 0.7 mm e caderno espiral.",
    price: UNIQUE_PRICE,
    image: canetas,
    imageKey: "canetas",
    dimensions: "Canetas ponta 0,7 mm; caderno tamanho A5",
    status: "available",
    maxPerCustomer: 0,
    category: "papelaria",
    tags: ["mais-vendido", "destaque"],
  },
  {
    id: "cubo-magico",
    name: "Cubo Mágico 3x3",
    description: "Giro suave e cores firmes. Diversão para todas as idades.",
    price: UNIQUE_PRICE,
    image: cubo,
    imageKey: "cubo",
    dimensions: "Aproximadamente 5,6 × 5,6 × 5,6 cm",
    status: "available",
    maxPerCustomer: 0,
    category: "brinquedos",
    tags: ["oferta"],
  },
  {
    id: "jogo-chaves-precisao",
    name: "Jogo de Chaves de Precisão 45 pçs",
    description: "Para celulares, óculos, eletrônicos e pequenos reparos.",
    price: UNIQUE_PRICE,
    image: chaves,
    imageKey: "chaves",
    dimensions: "Estojo de aproximadamente 20 × 11 × 5 cm; 45 peças",
    status: "available",
    maxPerCustomer: 0,
    category: "ferramentas",
    tags: ["novidade"],
  },
  {
    id: "fone-bluetooth",
    name: "Fone Bluetooth com Estojo",
    description: "Sem fio, estojo carregador e microfone embutido.",
    price: UNIQUE_PRICE,
    image: fone,
    imageKey: "fone",
    dimensions: "Estojo de aproximadamente 6 × 5 × 2,5 cm",
    status: "available",
    maxPerCustomer: 0,
    category: "acessorios",
    tags: ["novidade", "oferta", "destaque"],
  },
];

export function categoryLabel(id: CategoryId) {
  return categories.find((c) => c.id === id)?.label ?? id;
}

export function searchProducts(list: Product[], query: string, category: CategoryId | null) {
  const q = query
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return list.filter((p) => {
    if (category === "novidades") {
      if (p.category !== "novidades" && !p.tags.includes("novidade")) return false;
    } else if (category && p.category !== category) {
      return false;
    }
    if (!q) return true;
    const hay = `${p.name} ${p.description} ${p.dimensions} ${categoryLabel(p.category)}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return hay.includes(q);
  });
}
