import { createServerFn } from "@tanstack/react-start";
import { generateResponse } from "@lovable.dev/ai-gateway";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { getBahiaDate, validatePaymentProof } from "@/lib/payment-proof";

const ACTIVE_STATUSES = ["received", "in_progress", "awaiting_pix"] as const;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
type AcceptedType = (typeof ACCEPTED_TYPES)[number];

const analysisSchema = z.object({
  is_pix_receipt: z.boolean(),
  payment_completed: z.boolean(),
  is_scheduled: z.boolean(),
  visually_tampered: z.boolean(),
  paid_amount: z.number().nullable(),
  transaction_id: z.string().nullable(),
  transaction_date: z.string().nullable(),
  recipient_cnpj: z.string().nullable(),
  recipient_name: z.string().nullable(),
  recipient_bank: z.string().nullable(),
  reason: z.string(),
});

const orderIdSchema = z.object({ orderId: z.string().uuid() });
const manualReleaseSchema = z.object({ orderId: z.string().uuid(), reason: z.string().trim().min(8).max(300) });

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

async function requireActiveAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const [{ data: member }, { data: roles }] = await Promise.all([
    context.supabase
      .from("team_members")
      .select("user_id, active")
      .eq("user_id", context.userId)
      .maybeSingle(),
    context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
  ]);
  if (!member?.active || !roles?.some((item: { role: string }) => item.role === "admin")) {
    throw new Error("Liberação manual permitida exclusivamente para Admin ativo");
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
        model: "openai/gpt-5-mini",
        instructions:
          "Você confere documentos bancários com critério rigoroso. Analise somente o que está visível. Não invente dados e não presuma que uma imagem comum seja um comprovante.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Analise o documento como comprovante Pix. Extraia apenas dados legíveis: se é Pix, pagamento concluído, se agendado, sinais visuais de adulteração, valor em reais, ID E2E/código de autenticação, data YYYY-MM-DD, CNPJ ou identificação do recebedor, nome do destinatário e banco destinatário. Não invente dados; use null quando ausentes. Não declare autenticidade criptográfica, apenas informe sinais visuais. Comprovante de agendamento nunca é pagamento concluído. Retorne JSON estrito.",
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
                is_scheduled: { type: "boolean" },
                visually_tampered: { type: "boolean" },
                paid_amount: { type: ["number", "null"] },
                transaction_id: { type: ["string", "null"] },
                transaction_date: { type: ["string", "null"] },
                recipient_cnpj: { type: ["string", "null"] },
                recipient_name: { type: ["string", "null"] },
                recipient_bank: { type: ["string", "null"] },
                reason: { type: "string" },
              },
              required: ["is_pix_receipt", "payment_completed", "is_scheduled", "visually_tampered", "paid_amount", "transaction_id", "transaction_date", "recipient_cnpj", "recipient_name", "recipient_bank", "reason"],
              additionalProperties: false,
            },
          },
        },
        max_output_tokens: 1200,
      });
      const outputText = response.output
        .flatMap((item) => (item.type === "message" ? item.content : []))
        .find((item) => item.type === "output_text")?.text;
      if (!outputText) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const reviewPath = `${data.orderId}/review-${crypto.randomUUID()}`;
        const { error: uploadError } = await supabaseAdmin.storage.from("payment-proofs").upload(reviewPath, file, { contentType: file.type, upsert: false });
        if (uploadError) return { accepted: false as const, reason: "Não foi possível analisar nem salvar o comprovante para revisão." };
        const { error: saveError } = await supabaseAdmin.from("orders").update({
          payment_proof_path: reviewPath,
          payment_proof_name: file.name.slice(0, 160),
          payment_proof_type: file.type,
          payment_proof_amount: null,
          payment_proof_validated_at: null,
          payment_proof_validated_total: null,
        }).eq("id", data.orderId).eq("total", order.total).in("status", [...ACTIVE_STATUSES]);
        if (saveError) {
          await supabaseAdmin.storage.from("payment-proofs").remove([reviewPath]);
          return { accepted: false as const, reason: "Não foi possível registrar o comprovante para revisão do Admin." };
        }
        return { accepted: false as const, reason: "Não foi possível validar automaticamente. O comprovante foi salvo para revisão manual do Admin.", savedForReview: true as const };
      }
      analysis = analysisSchema.parse(JSON.parse(outputText));
    } catch {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const reviewPath = `${data.orderId}/review-${crypto.randomUUID()}`;
      const { error: uploadError } = await supabaseAdmin.storage.from("payment-proofs").upload(reviewPath, file, { contentType: file.type, upsert: false });
      if (uploadError) return { accepted: false as const, reason: "Não foi possível validar nem salvar o arquivo para revisão." };
      const { error: saveError } = await supabaseAdmin.from("orders").update({
        payment_proof_path: reviewPath,
        payment_proof_name: file.name.slice(0, 160),
        payment_proof_type: file.type,
        payment_proof_amount: null,
        payment_proof_validated_at: null,
        payment_proof_validated_total: null,
      }).eq("id", data.orderId).eq("total", order.total).in("status", [...ACTIVE_STATUSES]);
      if (saveError) {
        await supabaseAdmin.storage.from("payment-proofs").remove([reviewPath]);
        return { accepted: false as const, reason: "Não foi possível registrar o comprovante para revisão manual." };
      }
      return { accepted: false as const, reason: "Falha na análise automática. O comprovante foi salvo para revisão manual do Admin.", savedForReview: true as const };
    }

    const transactionId = analysis.transaction_id?.trim() ?? "";
    if (transactionId) {
      const { data: existing, error: duplicateError } = await context.supabase
        .from("orders")
        .select("id")
        .eq("payment_proof_name", `PIX_VALIDATED:${transactionId}`)
        .neq("id", order.id)
        .limit(1);
      if (duplicateError) return { accepted: false as const, reason: "Não foi possível verificar a duplicidade do ID Pix. Tente novamente." };
      if (existing?.length) return { accepted: false as const, reason: "❌ Comprovante duplicado: este ID de transação Pix já foi utilizado em outro pedido!" };
    }

    const saveForManualReview = async (reason: string) => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const reviewPath = `${order.id}/review-${crypto.randomUUID()}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("payment-proofs")
        .upload(reviewPath, file, { contentType: file.type, upsert: false });
      if (uploadError) return { accepted: false as const, reason: `${reason} O arquivo não pôde ser salvo para revisão do Admin.` };
      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
          payment_proof_path: reviewPath,
          payment_proof_name: file.name.slice(0, 160),
          payment_proof_type: file.type,
          payment_proof_amount: null,
          payment_proof_validated_at: null,
          payment_proof_validated_total: null,
        })
        .eq("id", order.id)
        .eq("total", order.total)
        .in("status", [...ACTIVE_STATUSES]);
      if (updateError) {
        await supabaseAdmin.storage.from("payment-proofs").remove([reviewPath]);
        return { accepted: false as const, reason: `${reason} O arquivo não pôde ser registrado para revisão.` };
      }
      return { accepted: false as const, reason, savedForReview: true as const };
    };

    const expectedDate = getBahiaDate(new Date(order.created_at));
    const validation = validatePaymentProof(analysis, Number(order.total), expectedDate);
    if (!validation.ok) return await saveForManualReview(validation.reason);

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
        payment_proof_name: `PIX_VALIDATED:${transactionId}`.slice(0, 160),
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
    return { accepted: true as const, order: updated, validation: { ...analysis, amount: validation.amount } };
  });

export const manualReleasePaymentProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => manualReleaseSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireActiveAdmin(context);
    const { data: order, error } = await context.supabase
      .from("orders")
      .select("id, total, status, payment_proof_path")
      .eq("id", data.orderId)
      .single();
    if (error || !order) throw new Error("Pedido não encontrado");
    if (!ACTIVE_STATUSES.includes(order.status as (typeof ACTIVE_STATUSES)[number])) {
      throw new Error("Somente pedidos em andamento podem receber liberação manual");
    }
    if (!order.payment_proof_path) {
      throw new Error("Anexe o comprovante antes de solicitar a liberação manual");
    }
    if (order.payment_proof_path && (await context.supabase.from("orders").select("payment_proof_name").eq("id", order.id).single()).data?.payment_proof_name?.startsWith("PIX_VALIDATED:")) {
      throw new Error("Este comprovante já está validado. A liberação manual só se aplica a comprovantes pendentes de revisão.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const marker = `PIX_VALIDATED:ADMIN_MANUAL:${data.reason.replace(/[\r\n]+/g, " ").trim()}`.slice(0, 160);
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        payment_proof_name: marker,
        payment_proof_amount: order.total,
        payment_proof_validated_at: new Date().toISOString(),
        payment_proof_validated_total: order.total,
      })
      .eq("id", order.id)
      .eq("total", order.total)
      .in("status", [...ACTIVE_STATUSES])
      .select()
      .single();
    if (updateError || !updated) throw new Error("Não foi possível registrar a liberação manual. Atualize o pedido e tente novamente.");
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
      name: order.payment_proof_name?.startsWith("PIX_VALIDATED:") ? "Comprovante Pix validado" : (order.payment_proof_name ?? "Comprovante Pix"),
      type: order.payment_proof_type ?? "application/pdf",
    };
  });
