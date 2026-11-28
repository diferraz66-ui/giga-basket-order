import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const DISMISSED_KEY = "giga-push-prompt-dismissed";

function isIosSafari() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    /safari/i.test(navigator.userAgent) &&
    !/(crios|fxios|edgios|opios)/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function decodeVapidKey(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}

export function PushNotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "default") return;
    if (window.sessionStorage.getItem(DISMISSED_KEY) === "1") return;
    const timer = window.setTimeout(() => {
      setHint(isIosSafari() && !isStandalone());
      setVisible(true);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, []);

  async function enableNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setHint(true);
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      setHint(true);
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setVisible(false);
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(VAPID_PUBLIC_KEY),
      });
      const json = subscription.toJSON();
      const endpoint = subscription.endpoint;
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!endpoint || !p256dh || !auth) throw new Error("A assinatura do navegador está incompleta.");

      const { error } = await supabase.rpc("save_push_subscription", {
        p_endpoint: endpoint,
        p_p256dh: p256dh,
        p_auth: auth,
        p_user_agent: navigator.userAgent.slice(0, 500),
      });
      if (error) throw error;
      setVisible(false);
    } catch {
      setHint(true);
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <aside className="fixed bottom-4 left-4 right-4 z-[80] mx-auto max-w-md rounded-2xl border border-white/30 bg-white p-4 text-[#111827] shadow-2xl">
      <button type="button" aria-label="Fechar aviso de notificações" onClick={() => {
        window.sessionStorage.setItem(DISMISSED_KEY, "1");
        setVisible(false);
      }} className="absolute right-3 top-3 rounded-full p-1 text-gray-500 hover:bg-gray-100"><X className="size-4" /></button>
      <div className="flex gap-3 pr-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"><Bell className="size-5" /></span>
        <div className="min-w-0">
          <p className="font-display text-sm font-extrabold uppercase">Fique por dentro da GIGA</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            {hint
              ? isIosSafari() && !isStandalone()
                ? "No iPhone, toque em Compartilhar → Adicionar à Tela de Início para receber alertas."
                : "Não foi possível ativar agora. Confira se o navegador permite notificações e tente novamente."
              : "Receba avisos de novidades e comunicados da loja."}
          </p>
          {!hint && <Button size="sm" className="mt-3" disabled={busy} onClick={() => void enableNotifications()}>{busy ? "Ativando..." : "Ativar notificações"}</Button>}
        </div>
      </div>
    </aside>
  );
}
