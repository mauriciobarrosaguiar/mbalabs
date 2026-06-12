import Link from "next/link";
import { recoverPasswordAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function RecoverPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Recuperar senha</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enviaremos um link seguro para definição de nova senha.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {params.enviado ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              Se o e-mail existir, o link de recuperação foi enviado.
            </div>
          ) : null}
          <form action={recoverPasswordAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <Button className="w-full" size="lg">Enviar link</Button>
          </form>
          <Link className="text-sm text-teal-700 hover:underline" href="/login">
            Voltar para login
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
