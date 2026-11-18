import { createServerFn } from "@tanstack/react-start";
import { generateResponse } from "@lovable.dev/ai-gateway";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { validatePaymentProof } from "@/lib/payment-proof";

const ACTIVE_STATUSES = ["received", "in_progress", "awaiting_pix"] as const;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
type AcceptedType = (typeof ACCEPTED_TYPES)[number];

const analysisSchema = z.object({
  is_pix_receipt: z.boolean(),
  payment_completed: z.boolean(),
  paid_amount: z.number().nullable(),
  reason: z.string(),
});

const orderIdSchema = z.object({ orderId: z.string().uuid() });

async function requireActiveStaff(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const [{ data: member }, { data: roles }] = await Promise.all([
    context.supabase
      .from("team_members")
      .select("user_id, active")
      .eq("user_id", context.userId)
      .maybeSingle(),
    context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
  ]);
  if (
    !member?.active ||
    !roles?.some((item: { role: string }) => item.role === "admin" || item.role === "vendedor")
  ) {
    throw new Error("Acesso permitido somente à equipe ativa");
  }
}

function hasValidSignature(bytes: Uint8Array, type: AcceptedType) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    );
  }
  return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
}

function publicFileUrl(signedUrl: string) {
  const publicUrl = process.env["VITE_SUPABASE_URL"]?.replace(/\/+$/, "");
  const serverUrl = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
  return publicUrl && serverUrl && signedUrl.startsWith(`${serverUrl}/`)
    ? `${publicUrl}${signedUrl.slice(serverUrl.length)}`
    : signedUrl;
}

export const uploadPaymentProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => {
    if (!(input instanceof FormData))
      throw new Error("Envie o comprovante em um formulário válido");
    const orderId = input.get("orderId");
    const file = input.get("file");
    if (typeof orderId !== "string" || !(file instanceof File))
      throw new Error("Pedido ou arquivo não informado");
    return { orderId: orderIdSchema.shape.orderId.parse(orderId), file };
  })
  .handler(async ({ data, context }) => {
    await requireActiveStaff(context);
    const { file } = data;
    if (
      !ACCEPTED_TYPES.includes(file.type as AcceptedType) ||
      file.size === 0 ||
      file.size > MAX_FILE_SIZE
    ) {
      return { accepted: false as const, reason: "Envie um arquivo JPG, PNG ou PDF de até 8 MB" };
    }

    const { data: order, error: orderError } = await context.supabase
      .from("orders")
      .select("*")
      .eq("id", data.orderId)
      .single();
    if (
      orderError ||
      !order ||
      !ACTIVE_STATUSES.includes(order.status as (typeof ACTIVE_STATUSES)[number])
    ) {
      return { accepted: false as const, reason: "Este pedido não está mais em andamento" };
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!hasValidSignature(bytes, file.type as AcceptedType)) {
      return {
        accepted: false as const,
        reason: "O conteúdo do arquivo não corresponde ao formato informado",
      };
    }

    let analysis: z.infer<typeof analysisSchema>;
    try {
      const base64 = Buffer.from(bytes).toString("base64");
      const media =
        file.type === "application/pdf"
          ? {
              type: "input_file" as const,
              filename: file.name.slice(0, 120),
              file_data: `data:application/pdf;base64,${base64}`,
            }
          : {
              type: "input_image" as const,
              image_url: `data:${file.type};base64,${base64}`,
              detail: "high" as const,
            };
      const response = await generateResponse({
        model: "openai/gpt-6-astra",
        instructions:
          "Você confere documentos bancários com critério rigoroso. Analise somente o que está visível. Não invente dados e não presuma que uma imagem comum seja um comprovante.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Verifique se o anexo é um comprovante bancário autêntico em aparência de uma transferência Pix concluída. Exija indicação clara de Pix, instituição ou identificação bancária e confirmação de pagamento/transferência. Rejeite fotos comuns, telas aleatórias, pedidos, conversas, boletos e documentos ambíguos. Extraia o valor efetivamente pago em reais, sem estimar. Se não houver valor legível, use null. Responda no esquema solicitado.",
              },
              media,
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "pix_receipt_validation",
            strict: true,
            schema: {
              type: "object",
              properties: {
                is_pix_receipt: { type: "boolean" },
                payment_completed: { type: "boolean" },
                paid_amount: { type: ["number", "null"] },
                reason: { type: "string" },
              },
              required: ["is_pix_receipt", "payment_completed", "paid_amount", "reason"],
              additionalProperties: false,
            },
          },
        },
        max_output_tokens: 1200,
      });
      const outputText = response.output
        .flatMap((item) => (item.type === "message" ? item.content : []))
        .find((item) => item.type === "output_text")?.text;
      if (!outputText)
        return {
          accepted: false as const,
          reason: "Não foi possível validar o comprovante. Tente um arquivo mais legível.",
        };
      analysis = analysisSchema.parse(JSON.parse(outputText));
    } catch {
      return {
        accepted: false as const,
        reason: "Não foi possível validar o comprovante agora. Tente novamente.",
      };
    }

    const validation = validatePaymentProof(analysis, Number(order.total));
    if (!validation.ok) return { accepted: false as const, reason: validation.reason };

    const path = `${order.id}/current`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uploadError } = await supabaseAdmin.storage
      .from("payment-proofs")
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
    if (uploadError)
      return {
        accepted: false as const,
        reason: "O comprovante foi validado, mas não pôde ser salvo. Tente novamente.",
      };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_proof_path: path,
        payment_proof_name: file.name.slice(0, 160),
        payment_proof_type: file.type,
        payment_proof_amount: validation.amount,
        payment_proof_validated_at: new Date().toISOString(),
        payment_proof_validated_total: order.total,
      })
      .eq("id", order.id)
      .eq("total", order.total)
      .in("status", [...ACTIVE_STATUSES])
      .select()
      .single();

    if (updateError || !updated) {
      await supabaseAdmin.storage.from("payment-proofs").remove([path]);
      return {
        accepted: false as const,
        reason: "O total ou a situação do pedido mudou. Salve e envie o comprovante novamente.",
      };
    }
    return { accepted: true as const, order: updated };
  });

export const getPaymentProofUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => orderIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireActiveStaff(context);
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("payment_proof_path, payment_proof_name, payment_proof_type")
      .eq("id", data.orderId)
      .single();
    if (error || !order?.payment_proof_path) throw new Error("Comprovante não encontrado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("payment-proofs")
      .createSignedUrl(order.payment_proof_path, 3600);
    if (signError || !signed?.signedUrl) throw new Error("Não foi possível abrir o comprovante");
    return {
      url: publicFileUrl(signed.signedUrl),
      name: order.payment_proof_name ?? "Comprovante Pix",
      type: order.payment_proof_type ?? "application/pdf",
    };
  });
