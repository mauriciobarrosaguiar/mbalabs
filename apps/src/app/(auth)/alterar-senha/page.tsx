import Link from "next/link";
import { updatePasswordAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Alterar senha</CardTitle>
          <p className="text-sm text-muted-foreground">
            Defina uma nova senha para sua conta. Nenhuma senha provisória é exibida.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {params.obrigatorio ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Troque a senha temporária para continuar.
            </div>
          ) : null}
          {params.erro ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {params.erro}
            </div>
          ) : null}
          <form action={updatePasswordAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <Button className="w-full" size="lg">Salvar nova senha</Button>
          </form>
          <Link className="text-sm text-teal-700 hover:underline" href="/login">
            Voltar para login
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
