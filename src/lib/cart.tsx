import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  cartTotal,
  isProductLimitReached,
  productLimitMessage,
  type CartItem,
} from "./order";

type CartContextValue = {
  items: CartItem[];
  purchasedQuantities: Record<string, number>;
  count: number;
  total: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  add: (item: Omit<CartItem, "quantity">) => boolean;
  setQuantity: (id: string, quantity: number, currentLimit?: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  refreshPurchased: () => Promise<void>;
  minimumItems: number;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "giga-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [purchasedQuantities, setPurchasedQuantities] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [minimumItems, setMinimumItems] = useState(10);

  useEffect(() => {
    let active = true;
    async function loadMinimum() {
      const { data } = await supabase
        .from("configuracoes_loja")
        .select("limite_minimo_pedido")
        .eq("id", 1)
        .maybeSingle();
      if (active && data) {
        const value = Number(data.limite_minimo_pedido);
        if (Number.isInteger(value) && value >= 1) setMinimumItems(value);
      }
    }
    void loadMinimum();
    const channel = supabase
      .channel("giga-store-minimum")
      .on("postgres_changes", { event: "*", schema: "public", table: "configuracoes_loja", filter: "id=eq.1" }, (payload) => {
        const value = Number((payload.new as { limite_minimo_pedido?: number })?.limite_minimo_pedido);
        if (Number.isInteger(value) && value >= 1) setMinimumItems(value);
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // carrinho salvo inválido: começa vazio
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, loaded]);

  const refreshPurchased = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) {
      setPurchasedQuantities({});
      return;
    }
    const { data } = await supabase
      .from("orders")
      .select("items")
      .eq("user_id", userId)
      .neq("status", "cancelled");
    const totals: Record<string, number> = {};
    for (const row of data ?? []) {
      if (!Array.isArray(row.items)) continue;
      for (const raw of row.items) {
        if (!raw || typeof raw !== "object") continue;
        const item = raw as { id?: unknown; quantity?: unknown };
        if (typeof item.id !== "string" || typeof item.quantity !== "number") continue;
        totals[item.id] = (totals[item.id] ?? 0) + item.quantity;
      }
    }
    setPurchasedQuantities(totals);
  }, [session?.user.id]);

  useEffect(() => {
    void refreshPurchased();
  }, [refreshPurchased]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      purchasedQuantities,
      minimumItems,
      count: items.reduce((n, i) => n + i.quantity, 0),
      total: cartTotal(items),
      open,
      setOpen,
      add: (item) => {
        const found = items.find((entry) => entry.id === item.id);
        const limit = item.maxPerCustomer ?? found?.maxPerCustomer ?? 0;
        const totalQuantity = (found?.quantity ?? 0) + (purchasedQuantities[item.id] ?? 0);
        if (isProductLimitReached(totalQuantity, limit)) {
          toast.error(productLimitMessage(limit));
          return false;
        }
        if (found && found.quantity >= 99) {
          toast.error("Quantidade máxima de 99 unidades por item.");
          return false;
        }
        setItems((prev) => {
          const current = prev.find((entry) => entry.id === item.id);
          if (current) {
            return prev.map((entry) =>
              entry.id === item.id
                ? { ...current, ...item, quantity: current.quantity + 1 }
                : entry,
            );
          }
          return [...prev, { ...item, quantity: 1 }];
        });
        return true;
      },
      setQuantity: (id, quantity, currentLimit) => {
        const found = items.find((entry) => entry.id === id);
        if (!found) return;
        if (quantity <= 0) {
          setItems((prev) => prev.filter((entry) => entry.id !== id));
          return;
        }
        const limit = currentLimit ?? found.maxPerCustomer ?? 0;
        if (limit > 0 && quantity + (purchasedQuantities[id] ?? 0) > limit) {
          toast.error(productLimitMessage(limit));
          return;
        }
        if (quantity > 99) {
          toast.error("Quantidade máxima de 99 unidades por item.");
          return;
        }
        setItems((prev) =>
          prev.map((entry) =>
            entry.id === id ? { ...entry, maxPerCustomer: limit, quantity } : entry,
          ),
        );
      },
      remove: (id) => setItems((prev) => prev.filter((entry) => entry.id !== id)),
      clear: () => setItems([]),
      refreshPurchased,
    }),
    [items, open, purchasedQuantities, refreshPurchased, minimumItems],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
