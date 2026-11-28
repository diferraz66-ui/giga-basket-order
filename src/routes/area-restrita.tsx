import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Loader2, LockKeyhole, LogOut, Minus, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/catalog/Logo";
import { PasswordChangeDialog } from "@/components/auth/PasswordChangeDialog";
import { AccountEmailDialog } from "@/components/auth/AccountEmailDialog";
import { OrdersPanel } from "@/components/internal/OrdersPanel";
import { ProductsPanel } from "@/components/internal/ProductsPanel";
import { QuickControlPanel } from "@/components/internal/QuickControlPanel";
import { CustomersPanel } from "@/components/internal/CustomersPanel";
import { ReportsTeamPanel } from "@/components/internal/ReportsTeamPanel";
import { BannersPanel } from "@/components/internal/BannersPanel";
import { ReviewsPanel } from "@/components/internal/ReviewsPanel";
import { PushNotificationsPanel } from "@/components/internal/PushNotificationsPanel";
import { ProductAuthorizationsPanel } from "@/components/internal/ProductAuthorizationsPanel";
import { SellerProductPanel } from "@/components/internal/ProductAuthorizationsPanel";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { staffAuthPassword, staffLoginEmail, staffLoginSchema, type StaffRole } from "@/lib/staff";
import { canShowSellerForm } from "@/lib/product-submission";

export type TeamMemberPermissions = {
  active: boolean;
  pode_ver_todos_pedidos: boolean; pode_editar_pedidos: boolean; pode_cancelar_pedidos: boolean;
  pode_ignorar_pedido_minimo: boolean; pode_anexar_pix: boolean; pode_enviar_orientacoes_pix: boolean;
  pode_alterar_status_produtos: boolean; pode_ver_totais_financeiros: boolean; pode_cadastrar_produtos: boolean;
};
const defaultTeamMemberPermissions: TeamMemberPermissions = {
  pode_ver_todos_pedidos: true, pode_editar_pedidos: true, pode_cancelar_pedidos: true,
  active: true, pode_ignorar_pedido_minimo: true, pode_anexar_pix: true, pode_enviar_orientacoes_pix: true,
  pode_alterar_status_produtos: true, pode_ver_totais_financeiros: true, pode_cadastrar_produtos: true,
};
export const Route = createFileRoute("/area-restrita")({
  head: () => ({
    meta: [
      { title: "Área Restrita — GIGA SHOPPING" },
      { name: "description", content: "Gestão interna de pedidos, Pix, catálogo, clientes e equipe da GIGA SHOPPING." },
      { property: "og:title", content: "Área Restrita — GIGA SHOPPING" },
      { property: "og:description", content: "Acesso exclusivo da equipe GIGA SHOPPING." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InternalArea,
});

function InternalArea() {
  const { session, loading } = useAuth();
  const [member, setMember] = useState<Tables<"team_members"> | null>(null);
  const [role, setRole] = useState<StaffRole | null>(null);
  const [checking, setChecking] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    let active = true;
    if (!userId) {
      setMember(null);
      setRole(null);
      setChecking(false);
      return () => { active = false; };
    }

    // Revalidate only when the authenticated user changes, not on token refresh/focus.
    setChecking(true);
    void Promise.all([
      supabase.from("team_members").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]).then(([{ data: teamMember }, { data: roles }]) => {
      if (!active) return;
      const staffRole =
        roles?.find((item) => item.role === "admin")?.role ??
        roles?.find((item) => item.role === "vendedor")?.role ??
        null;
      setMember(teamMember?.active ? teamMember : null);
      setRole(teamMember?.active ? staffRole : null);
      setChecking(false);
    }).catch(() => {
      if (!active) return;
      setMember(null);
      setRole(null);
      setChecking(false);
    });

    return () => { active = false; };
  }, [userId]);

  if (loading || (session && checking)) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }
  if (!session || !member || !role) return <StaffLogin hasCustomerSession={Boolean(session && !checking)} />;
  return <StaffDashboard member={member} role={role} permissions={member} />;
}

function AccessBlocked() {
  const { signOut } = useAuth();
  return <main className="flex min-h-screen items-center justify-center bg-background p-6"><section className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-6 text-center"><h1 className="text-xl font-bold">Acesso bloqueado</h1><p className="text-muted-foreground">Seu acesso foi bloqueado pelo administrador.</p><Button onClick={() => void signOut()}><LogOut className="mr-2 size-4" /> Sair</Button></section></main>;
}

function StaffLogin({ hasCustomerSession }: { hasCustomerSession: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = staffLoginSchema.safeParse({ username, password });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Confira os dados"); return; }
    setBusy(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: parsed.data.username.includes("@") ? parsed.data.username : staffLoginEmail(parsed.data.username),
      password: staffAuthPassword(parsed.data.password),
    });
    setBusy(false);
    if (authError) setError("Login ou senha incorretos, ou usuário ainda não cadastrado.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-soft sm:p-8">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="size-4" /> Voltar ao catálogo</Link>
        <Logo eager className="w-52" />
        <div className="mt-6 flex items-center gap-2"><LockKeyhole className="size-5 text-primary" /><h1 className="text-xl uppercase">Área Restrita</h1></div>
        <p className="mt-2 text-sm text-muted-foreground">Acesso exclusivo para Admin/Financeiro e Vendedor.</p>
        {hasCustomerSession && <p className="mt-4 rounded-lg bg-accent p-3 text-sm text-accent-foreground">A conta atual é de cliente. Entre com um login da equipe para continuar.</p>}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5"><Label htmlFor="staff-username">E-mail ou login</Label><Input id="staff-username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoComplete="username" placeholder="E-mail ou login da equipe" className="h-12" /></div>
          <button type="button" className="text-sm font-medium text-primary underline" onClick={async () => {
            if (!username.includes("@")) return setError("Informe o e-mail cadastrado para receber o link de redefinição.");
            setBusy(true);
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(username.trim(), { redirectTo: window.location.origin });
            setBusy(false);
            setError(resetError ? "Não foi possível enviar o link. Confira o e-mail." : "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
          }}>Esqueci minha senha</button>
          <div className="space-y-1.5"><Label htmlFor="staff-password">Senha</Label><Input id="staff-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-12" /></div>
          {error && <p role="alert" className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">{error}</p>}
          <Button type="submit" variant="cta" className="h-12 w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Entrar na área restrita</Button>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground">Usuários de teste: <strong>admin</strong> e <strong>vendedor</strong> · senha <strong>123</strong></p>
      </div>
    </main>
  );
}

function StaffDashboard({ member, role, permissions }: { member: Tables<"team_members">; role: StaffRole; permissions: TeamMemberPermissions }) {
  const { signOut } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");
  const [sellerAllowed, setSellerAllowed] = useState(false);
  const [minimumItems, setMinimumItems] = useState(10);
  const [savedMinimumItems, setSavedMinimumItems] = useState(10);
  const [savingMinimum, setSavingMinimum] = useState(false);
  useEffect(() => {
    let active = true;
    async function refresh() {
      const { data } = await supabase.from("team_members").select("active,pode_cadastrar_produtos").eq("user_id", member.user_id).maybeSingle();
      if (active) setSellerAllowed(canShowSellerForm(role, Boolean(data?.active), Boolean(data?.pode_cadastrar_produtos)));
    }
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [member.user_id, role]);
  useEffect(() => {
    const saved = window.sessionStorage.getItem(`giga-internal-active-tab:${member.user_id}`) ?? window.sessionStorage.getItem("giga-internal-active-tab");
    const allowed = role === "admin" ? ["orders", "products", "quick-control", "customers", "reports", "banners", "reviews", "authorizations", "push-notifications"] : ["orders", ...(sellerAllowed ? ["seller-products"] : [])];
    setActiveTab(!new URLSearchParams(window.location.search).has("pedido") && saved && allowed.includes(saved) ? saved : "orders");
  }, [member.user_id, role, sellerAllowed]);
  useEffect(() => {
    if (role !== "admin") return;
    let active = true;
    async function loadMinimum() {
      const { data, error } = await supabase.from("configuracoes_loja").select("limite_minimo_pedido").eq("id", 1).maybeSingle();
      if (!active) return;
      if (error) {
        toast.error("Não foi possível carregar o pedido mínimo.");
        return;
      }
      const value = Number(data?.limite_minimo_pedido ?? 10);
      const safeValue = Number.isInteger(value) && value >= 1 ? value : 10;
      setMinimumItems(safeValue);
      setSavedMinimumItems(safeValue);
    }
    void loadMinimum();
    return () => { active = false; };
  }, [role]);

  async function saveMinimumItems() {
    if (!Number.isInteger(minimumItems) || minimumItems < 1 || minimumItems > 500) {
      toast.error("Informe um mínimo entre 1 e 500 itens.");
      return;
    }
    setSavingMinimum(true);
    const { error } = await supabase.from("configuracoes_loja").upsert({ id: 1, limite_minimo_pedido: minimumItems });
    setSavingMinimum(false);
    if (error) {
      toast.error("Não foi possível salvar o pedido mínimo.");
      return;
    }
    setSavedMinimumItems(minimumItems);
    toast.success(`Pedido mínimo atualizado para ${minimumItems} itens.`);
  }

  async function logout() { await signOut(); toast.success("Você saiu da área restrita"); }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4"><Link to="/" aria-label="Voltar ao catálogo"><Logo className="w-20 sm:w-24" /></Link><span className="hidden h-8 w-px bg-border sm:block" /><div><p className="text-xs text-muted-foreground">Área Restrita · {role === "admin" ? "Admin/Financeiro" : "Vendedor"}</p><p className="text-sm font-bold">{member.full_name}</p></div></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setEmailOpen(true)}>Atualizar e-mail</Button><Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}><KeyRound /> Alterar senha</Button><Button variant="outline" size="sm" onClick={() => void logout()}><LogOut /> Sair</Button></div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-5">
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            window.sessionStorage.setItem(`giga-internal-active-tab:${member.user_id}`, value);
          }}
        >
          {role === "admin" && <section className="mb-5 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-extrabold uppercase">Pedido mínimo da loja</h2>
                <p className="mt-1 text-xs text-muted-foreground">Defina quantas unidades o cliente precisa colocar no carrinho para liberar a finalização.</p>
                <p className="mt-1 text-sm font-bold">Limite atual: {savedMinimumItems} itens</p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="icon" aria-label="Diminuir pedido mínimo" disabled={minimumItems <= 1 || savingMinimum} onClick={() => setMinimumItems(value => Math.max(1, value - 1))}><Minus /></Button>
                <Input className="w-20 text-center font-bold" type="number" min="1" max="500" value={minimumItems} onChange={event => setMinimumItems(Number(event.target.value))} aria-label="Quantidade mínima de itens" />
                <Button type="button" variant="outline" size="icon" aria-label="Aumentar pedido mínimo" disabled={minimumItems >= 500 || savingMinimum} onClick={() => setMinimumItems(value => Math.min(500, value + 1))}><Plus /></Button>
                <Button type="button" variant="cta" disabled={savingMinimum || minimumItems === savedMinimumItems} onClick={() => void saveMinimumItems()}>{savingMinimum ? <Loader2 className="animate-spin" /> : <Save />} Salvar</Button>
              </div>
            </div>
          </section>}
          <TabsList className="no-scrollbar mb-5 flex h-auto w-full justify-start gap-1 overflow-x-auto bg-muted p-1">
            <TabsTrigger value="orders" className="shrink-0 px-4 py-2.5">Pedidos</TabsTrigger>
            {role === "admin" && <TabsTrigger value="products" className="shrink-0 px-4 py-2.5">Produtos e Estoque</TabsTrigger>}
            {role === "admin" && <TabsTrigger value="quick-control" className="shrink-0 px-4 py-2.5">Controle Rápido (Lista)</TabsTrigger>}
            {role === "admin" && <TabsTrigger value="customers" className="shrink-0 px-4 py-2.5">Clientes GIGA</TabsTrigger>}
            {role === "admin" && <TabsTrigger value="reports" className="shrink-0 px-4 py-2.5">Relatórios e Equipe</TabsTrigger>}
            {role === "admin" && <TabsTrigger value="banners" className="shrink-0 px-4 py-2.5">Banners Topo</TabsTrigger>}
            {role === "admin" && <TabsTrigger value="reviews" className="shrink-0 px-4 py-2.5">Avaliações</TabsTrigger>}
            {role === "admin" && <TabsTrigger value="authorizations" className="shrink-0 px-4 py-2.5">Autorizações</TabsTrigger>}
            {role === "admin" && <TabsTrigger value="push-notifications" className="shrink-0 px-4 py-2.5">Notificações Push</TabsTrigger>}
            {role === "vendedor" && sellerAllowed && <TabsTrigger value="seller-products" className="shrink-0 px-4 py-2.5">Incluir Produto</TabsTrigger>}
          </TabsList>
          <TabsContent value="orders"><OrdersPanel role={role} permissions={permissions} targetOrder={typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("pedido") : null} /></TabsContent>
          {role === "admin" && <TabsContent value="products"><ProductsPanel /></TabsContent>}
          {role === "admin" && <TabsContent value="quick-control"><QuickControlPanel /></TabsContent>}
          {role === "admin" && <TabsContent value="customers"><CustomersPanel /></TabsContent>}
          {role === "admin" && <TabsContent value="reports"><ReportsTeamPanel /></TabsContent>}
          {role === "admin" && <TabsContent value="banners"><BannersPanel /></TabsContent>}
          {role === "admin" && <TabsContent value="reviews"><ReviewsPanel /></TabsContent>}
          {role === "admin" && <TabsContent value="authorizations"><ProductAuthorizationsPanel /></TabsContent>}
          {role === "admin" && <TabsContent value="push-notifications"><PushNotificationsPanel /></TabsContent>}
          {role === "vendedor" && sellerAllowed && <TabsContent value="seller-products"><SellerProductPanel userId={member.user_id} permissions={permissions} /></TabsContent>}
        </Tabs>
      </main>
      <PasswordChangeDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      <AccountEmailDialog open={emailOpen} onOpenChange={setEmailOpen} />
    </div>
  );
}
