export function sellerSubmissionFields(userId: string) {
  return {
    status_aprovacao: "pendente",
    cadastrado_por: userId,
    price: 7.5,
    status: "available",
    tags: [] as string[],
    max_per_customer: 0,
    image_key: null,
  };
}

export function canShowSellerForm(role: string, active: boolean, allowed: boolean) {
  return role === "vendedor" && active && allowed;
}