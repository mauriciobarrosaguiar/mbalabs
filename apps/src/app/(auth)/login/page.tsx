import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Entrar no MBA Cotações"
      description="Acesse sua conta no MBA Cotações"
    >
      {params.erro ? (
        <div className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {params.erro}
        </div>
      ) : null}
      {params.senha ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Senha alterada. Entre novamente.
        </div>
      ) : null}
      <form action="/api/auth/login" method="post" className="space-y-4">
        {params.next ? <input type="hidden" name="next" value={params.next} /> : null}
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button className="w-full" size="lg">Entrar</Button>
      </form>
      <div className="flex items-center justify-between text-sm">
        <Link className="text-teal-700 hover:underline" href="/recuperar-senha">
          Recuperar senha
        </Link>
        <Link className="text-muted-foreground hover:text-slate-950" href="/">
          Voltar
        </Link>
      </div>
    </AuthShell>
  );
}

function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardHeader>
        <CardContent className="space-y-5">{children}</CardContent>
      </Card>
    </main>
  );
}
