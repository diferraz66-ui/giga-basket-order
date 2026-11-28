import { describe, expect, it, vi } from "vitest";
import { assertPushAdmin, deliverPushNotifications, isPushEndpoint, pushMessageSchema, type PushDevice } from "./push";

const device = (id: string): PushDevice => ({ id, endpoint: `https://fcm.googleapis.com/fcm/send/${id}`, p256dh: "test-only", auth: "test-only" });

describe("Web Push access and input", () => {
  it("allows an authenticated Admin role", async () => {
    await expect(assertPushAdmin(async () => true)).resolves.toBeUndefined();
  });
  it("denies a non-Admin role", async () => {
    await expect(assertPushAdmin(async () => false)).rejects.toThrow("Somente Admin");
  });
  it("requires title, body and an internal destination", () => {
    expect(pushMessageSchema.parse({ title: "Novidades", body: "Produtos novos", url: "/?categoria=novidades" })).toEqual({ title: "Novidades", body: "Produtos novos", url: "/?categoria=novidades" });
    for (const url of ["https://example.com", "//example.com", "/\\example.com", "/\n/example.com"]) {
      expect(pushMessageSchema.safeParse({ title: "Novidades", body: "Produtos novos", url }).success).toBe(false);
    }
    expect(pushMessageSchema.safeParse({ title: "Novidades", url: "/" }).success).toBe(false);
  });
  it("never contacts arbitrary or local URLs from public subscriptions", () => {
    expect(isPushEndpoint("https://web.push.apple.com/device/token")).toBe(true);
    for (const endpoint of ["http://fcm.googleapis.com/token", "https://127.0.0.1/token", "https://fcm.googleapis.com.evil.test/token", "https://fcm.googleapis.com:8443/token", "https://user@fcm.googleapis.com/token"]) expect(isPushEndpoint(endpoint)).toBe(false);
  });
});

describe("Web Push delivery", () => {
  it.each([404, 410])("removes expired endpoints on HTTP %s", async status => {
    const remove = vi.fn(async () => {});
    const result = await deliverPushNotifications({ list: async after => after ? [] : [device("a")], send: async () => status, remove });
    expect(result).toEqual({ sent: 0, failed: 1, removed: 1 });
    expect(remove).toHaveBeenCalledWith("a");
  });
  it("counts accepted deliveries and retains other failures", async () => {
    const statuses = new Map([["a", 201], ["b", 429], ["c", 500]]);
    const remove = vi.fn(async () => {});
    const result = await deliverPushNotifications({ list: async after => after ? [] : [device("a"), device("b"), device("c")], send: async row => statuses.get(row.id) ?? 500, remove });
    expect(result).toEqual({ sent: 1, failed: 2, removed: 0 });
    expect(remove).not.toHaveBeenCalled();
  });
  it("continues beyond the first page even while removing rows", async () => {
    const list = vi.fn(async (after: string | null) => after === null ? [device("a")] : after === "a" ? [device("b")] : []);
    expect(await deliverPushNotifications({ list, send: async row => row.id === "a" ? 410 : 201, remove: async () => {} })).toEqual({ sent: 1, failed: 1, removed: 1 });
    expect(list.mock.calls).toEqual([[null], ["a"], ["b"]]);
  });
  it("does not claim a failed deletion succeeded", async () => {
    expect(await deliverPushNotifications({ list: async after => after ? [] : [device("a")], send: async () => 410, remove: async () => { throw new Error("unavailable"); } })).toEqual({ sent: 0, failed: 1, removed: 0 });
  });
  it("continues after a network error without removing the device", async () => {
    const remove = vi.fn(async () => {});
    expect(await deliverPushNotifications({ list: async after => after ? [] : [device("a"), device("b")], send: async row => { if (row.id === "a") throw new Error("timeout"); return 201; }, remove })).toEqual({ sent: 1, failed: 1, removed: 0 });
    expect(remove).not.toHaveBeenCalled();
  });
});