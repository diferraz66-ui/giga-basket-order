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
  // WhatsApp da loja que recebe os pedidos: só dígitos, com 55 + DDD.
  whatsapp: "5575981785898",
};

/** Preço único da loja, igual à logo. */
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

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  image: string;
  category: CategoryId;
  tags: Array<"oferta" | "mais-vendido" | "novidade" | "destaque">;
};

export const products: Product[] = [
  {
    id: "kit-potes-hermeticos",
    name: "Kit 5 Potes Herméticos",
    description: "Tampas com vedação, vão ao micro-ondas e à geladeira.",
    price: UNIQUE_PRICE,
    image: potes,
    category: "cozinha",
    tags: ["oferta", "mais-vendido"],
  },
  {
    id: "luminaria-led-mesa",
    name: "Luminária LED de Mesa",
    description: "Luz quente com toque, cabeça giratória e cabo USB.",
    price: UNIQUE_PRICE,
    image: luminaria,
    category: "casa-decoracao",
    tags: ["destaque"],
  },
  {
    id: "organizador-acrilico",
    name: "Organizador Acrílico 4 Gavetas",
    description: "Ideal para maquiagem, bijuterias e escritório.",
    price: UNIQUE_PRICE,
    image: organizador,
    category: "organizacao",
    tags: ["oferta", "destaque"],
  },
  {
    id: "kit-pinceis-maquiagem",
    name: "Kit 9 Pincéis de Maquiagem",
    description: "Cerdas macias com porta-pincéis incluso.",
    price: UNIQUE_PRICE,
    image: pinceis,
    category: "beleza",
    tags: ["mais-vendido"],
  },
  {
    id: "canetas-gel-caderno",
    name: "Kit 12 Canetas Gel + Caderno",
    description: "Cores vibrantes, ponta 0.7 mm e caderno espiral.",
    price: UNIQUE_PRICE,
    image: canetas,
    category: "papelaria",
    tags: ["mais-vendido", "destaque"],
  },
  {
    id: "cubo-magico",
    name: "Cubo Mágico 3x3",
    description: "Giro suave e cores firmes. Diversão para todas as idades.",
    price: UNIQUE_PRICE,
    image: cubo,
    category: "brinquedos",
    tags: ["oferta"],
  },
  {
    id: "jogo-chaves-precisao",
    name: "Jogo de Chaves de Precisão 45 pçs",
    description: "Para celulares, óculos, eletrônicos e pequenos reparos.",
    price: UNIQUE_PRICE,
    image: chaves,
    category: "ferramentas",
    tags: ["novidade"],
  },
  {
    id: "fone-bluetooth",
    name: "Fone Bluetooth com Estojo",
    description: "Sem fio, estojo carregador e microfone embutido.",
    price: UNIQUE_PRICE,
    image: fone,
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
      if (!p.tags.includes("novidade")) return false;
    } else if (category && p.category !== category) {
      return false;
    }
    if (!q) return true;
    const hay = `${p.name} ${p.description} ${categoryLabel(p.category)}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return hay.includes(q);
  });
}
