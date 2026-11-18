/** Normaliza um WhatsApp brasileiro para só dígitos com 55 na frente. Retorna null se inválido. */
export function normalizeWhatsapp(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55\d{10,11}$/.test(digits)) return null;
  return digits;
}

/** E-mail interno usado só como login: o cliente nunca vê nem recebe nada nele. */
export function whatsappToLoginEmail(normalized: string) {
  return `${normalized}@clientes.gigashopping.app`;
}

export function formatWhatsapp(normalized: string) {
  const local = normalized.startsWith("55") ? normalized.slice(2) : normalized;
  const ddd = local.slice(0, 2);
  const rest = local.slice(2);
  if (rest.length === 9) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  if (rest.length === 8) return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return normalized;
}
