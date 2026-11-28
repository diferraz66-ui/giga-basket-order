import { z } from "zod";

const pushHosts = /^(?:fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com|web\.push\.apple\.com)$/;

export function isPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.port && pushHosts.test(url.hostname) && url.pathname !== "/";
  } catch {
    return false;
  }
}

export const pushMessageSchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(240),
  url: z.string().trim().max(2048).default("/").refine(value => {
    if (!value.startsWith("/") || value.startsWith("//") || /[\\\s\u0000-\u001f]/.test(value)) return false;
    return new URL(value, "https://gigashopping.lovable.app").origin === "https://gigashopping.lovable.app";
  }, "Informe um caminho interno da loja"),
});

export type PushMessageInput = z.infer<typeof pushMessageSchema>;
export type PushDevice = { id: string; endpoint: string; p256dh: string; auth: string };
export type PushFailure = { status: number | null; reason: string; count: number };
export type PushResult = { sent: number; failed: number; removed: number; failures: PushFailure[] };

function recordPushFailure(failures: PushFailure[], status: number | null, reason: string) {
  const normalizedReason = (reason || "Erro sem detalhe retornado pelo serviço Push").slice(0, 500);
  const existing = failures.find(item => item.status === status && item.reason === normalizedReason);
  if (existing) existing.count += 1;
  else failures.push({ status, reason: normalizedReason, count: 1 });
}

export async function assertPushAdmin(checkRole: () => Promise<boolean>) {
  if (!(await checkRole())) throw new Error("Somente Admin pode enviar notificações");
}

// Keyset pagination remains stable when expired rows are deleted during a campaign.
export async function deliverPushNotifications(dependencies: {
  list: (afterId: string | null) => Promise<PushDevice[]>;
  send: (device: PushDevice) => Promise<number | { status: number; reason: string }>;
  remove: (id: string) => Promise<void>;
}): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, removed: 0, failures: [] };
  let afterId: string | null = null;
  while (true) {
    const devices = await dependencies.list(afterId);
    if (!devices.length) break;
    for (let index = 0; index < devices.length; index += 4) {
      await Promise.all(devices.slice(index, index + 4).map(async device => {
        if (!isPushEndpoint(device.endpoint)) {
          result.failed += 1;
          return;
        }
        let response: number | { status: number; reason: string };
        try {
          response = await dependencies.send(device);
        } catch (error) {
          result.failed += 1;
          recordPushFailure(result.failures, null, error instanceof Error ? error.message : "Falha de rede");
          return;
        }
        const status = typeof response === "number" ? response : response.status;
        const reason = typeof response === "number" ? `HTTP ${status}` : response.reason;
        if (status >= 200 && status < 300) {
          result.sent += 1;
          return;
        }
        result.failed += 1;
        recordPushFailure(result.failures, status, reason);
        if (status === 404 || status === 410) {
          try {
            await dependencies.remove(device.id);
            result.removed += 1;
          } catch {
            // Failed deletion is not reported as removed; retry on the next campaign.
          }
        }
      }));
    }
    const last = devices.at(-1);
    if (!last || last.id === afterId) throw new Error("Não foi possível continuar o envio");
    afterId = last.id;
  }
  return result;
}