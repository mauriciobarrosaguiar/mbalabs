import { AppNav } from "@/components/AppNav";
import { AccessDenied } from "@/components/ui-kit";
import { requireSessionProfile } from "@/lib/core-data";
import { safeNextPath } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

const appNames: Record<string, string> = {
  "mba-cotacoes": "MBA Cotações",
  mbacotacoes: "MBA Cotações",
  lavagestor: "LavaGestor",
  bikecomanda: "BikeComanda",
  "bike-comanda": "BikeComanda",
  "portal-associativo": "Portal Associativo"
};

const reasonNames: Record<string, string> = {
  usuario: "sua conta",
  empresa: "sua empresa",
  "sem-app": "os sistemas contratados",
  assinatura: "a assinatura da empresa"
};

export default async function AcessoBloqueadoPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSessionProfile("/acesso-bloqueado");
  const params = await searchParams;
  const app = Array.isArray(params.app) ? params.app[0] : params.app;
  const motivo = Array.isArray(params.motivo) ? params.motivo[0] : params.motivo;
  const appName = app ? appNames[app] ?? app : reasonNames[motivo ?? ""] ?? "este sistema";

  return (
    <main>
      <AppNav />
      <section className="page-shell py-10">
        <AccessDenied appName={appName} backHref={safeNextPath(params.next, "/dashboard")} />
      </section>
    </main>
  );
}
