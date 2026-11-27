import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { registerCustomer, resetCustomerPassword } from "./customer-auth.server";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const registerCustomerFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    full_name: z.string().trim().min(2).max(120), whatsapp: z.string().max(30), birth_date: date,
    password: z.string().min(6).max(72), accepts_offers: z.boolean().default(false),
  }).parse(d))
  .handler(({ data }) => registerCustomer(data));

export const resetCustomerPasswordFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({
    whatsapp: z.string().max(30), full_name: z.string().trim().min(2).max(120), birth_date: date,
    new_password: z.string().min(6).max(72),
  }).parse(d))
  .handler(({ data }) => resetCustomerPassword(data));
