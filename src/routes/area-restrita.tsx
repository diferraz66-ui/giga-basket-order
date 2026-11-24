import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, LockKeyhole, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/catalog/Logo";
import { PasswordChangeDialog } from "@/components/auth/PasswordChangeDialog";
import { KeyRound } from "lucide-react";
import { OrdersPanel } from "@/components/internal/OrdersPanel";
import { ProductsPanel } from "@/components/internal/ProductsPanel";
import { QuickControlPanel } from "@/components/internal/QuickControlPanel";
import { CustomersPanel } from "@/components/internal/CustomersPanel";
import { ReportsTeamPanel } from "@/components/internal/ReportsTeamPanel";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { staffAuthPassword, staffLoginEmail, staffLoginSchema, type StaffRole } from "@/lib/staff";

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

  useEffect(() => {
    let active = true;
    if (!session?.user) {
      setMember(null); setRole(null); setChecking(false);
      return () => { active = false; };
    }
    setChecking(true);
    void Promise.all([
      supabase.from("team_members").select("*").eq("user_id", session.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", session.user.id),
    ]).then(([{ data: teamMember }, { data: roles }]) => {
      if (!active) return;
      const staffRole = roles?.find((item) => item.role === "admin")?.role ?? roles?.find((item) => item.role === "vendedor")?.role ?? null;
      setMember(teamMember?.active ? teamMember : null);
      setRole(teamMember?.active ? staffRole : null);
      setChecking(false);
    });
    return () => { active = false; };
  }, [session?.user]);

  if (loading || (session && checking)) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }
  if (!session || !member || !role) return <StaffLogin hasCustomerSession={Boolean(session && !checking)} />;
  return <StaffDashboard member={member} role={role} />;
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
      email: staffLoginEmail(parsed.data.username),
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
          <div className="space-y-1.5"><Label htmlFor="staff-username">Login</Label><Input id="staff-username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoComplete="username" placeholder="admin ou vendedor" className="h-12" /></div>
          <div className="space-y-1.5"><Label htmlFor="staff-password">Senha</Label><Input id="staff-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-12" /></div>
          {error && <p role="alert" className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">{error}</p>}
          <Button type="submit" variant="cta" className="h-12 w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Entrar na área restrita</Button>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground">Usuários de teste: <strong>admin</strong> e <strong>vendedor</strong> · senha <strong>123</strong></p>
      </div>
    </main>
  );
}

function StaffDashboard({ member, role }: { member: Tables<"team_members">; role: StaffRole }) {
  const { signOut } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  async function logout() { await signOut(); toast.success("Você saiu da área restrita"); }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4"><Link to="/" aria-label="Voltar ao catálogo"><Logo className="w-20 sm:w-24" /></Link><span className="hidden h-8 w-px bg-border sm:block" /><div><p className="text-xs text-muted-foreground">Área Restrita · {role === "admin" ? "Admin/Financeiro" : "Vendedor"}</p><p className="text-sm font-bold">{member.full_name}</p></div></div>
          <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setPasswordOpen(true)}><KeyRound /> Alterar senha</Button><Button variant="outline" size="sm" onClick={() => void logout()}><LogOut /> Sair</Button></div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-5">
        <Tabs defaultValue="orders">
          <TabsList className="no-scrollbar mb-5 flex h-auto w-full justify-start gap-1 overflow-x-auto bg-muted p-1">
            <TabsTrigger value="orders" className="shrink-0 px-4 py-2.5">Pedidos</TabsTrigger>
            {role === "admin" && <TabsTrigger value="products" className="shrink-0 px-4 py-2.5">Produtos e Estoque</TabsTrigger>}
            {role === "admin" && <TabsTrigger value="quick-control" className="shrink-0 px-4 py-2.5">Controle Rápido (Lista)</TabsTrigger>}
            {role === "admin" && <TabsTrigger value="customers" className="shrink-0 px-4 py-2.5">Clientes GIGA</TabsTrigger>}
            {role === "admin" && <TabsTrigger value="reports" className="shrink-0 px-4 py-2.5">Relatórios e Equipe</TabsTrigger>}
          </TabsList>
          <TabsContent value="orders"><OrdersPanel role={role} /></TabsContent>
          {role === "admin" && <TabsContent value="products"><ProductsPanel /></TabsContent>}
          {role === "admin" && <TabsContent value="quick-control"><QuickControlPanel /></TabsContent>}
          {role === "admin" && <TabsContent value="customers"><CustomersPanel /></TabsContent>}
          {role === "admin" && <TabsContent value="reports"><ReportsTeamPanel /></TabsContent>}
        </Tabs>
      </main>
      <PasswordChangeDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
