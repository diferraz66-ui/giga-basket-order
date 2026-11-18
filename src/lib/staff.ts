import { z } from "zod";

export type StaffRole = "admin" | "vendedor";

export const staffLoginSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, "Use de 3 a 30 letras, números, ponto, hífen ou sublinhado"),
  password: z.string().min(3, "A senha precisa ter pelo menos 3 caracteres").max(72),
});

export function staffLoginEmail(username: string) {
  const normalized = username.trim().toLowerCase();
  return `${normalized}@equipe.gigashopping.app`;
}

// A senha digitada pela equipe é convertida para uma credencial maior, exigida pelo serviço de acesso.
// As permissões continuam sendo validadas no banco; esta função não concede nenhum acesso.
export function staffAuthPassword(password: string) {
  return `GIGA-equipe-2026:${password}`;
}

export const orderStatusLabels = {
  received: "Recebido",
  in_progress: "Em Atendimento",
  awaiting_pix: "Aguardando Pix",
  completed: "Venda Concluída",
  cancelled: "Cancelado",
} as const;

export type OrderStatus = keyof typeof orderStatusLabels;
