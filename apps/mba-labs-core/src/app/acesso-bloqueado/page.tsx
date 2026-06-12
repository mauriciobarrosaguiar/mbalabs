import { AppNav } from "@/components/AppNav";
import { AccessDenied } from "@/components/ui-kit";
import { requireSessionProfile } from "@/lib/core-data";
import { safeNextPath } from "@/lib/form-utils";

export const dynamic = "force-dynamic";

const appNames: Record<string, string> = {
  "mba-cotacoes": "MBA Cotações",
  lavagestor: "LavaGestor"
};

export default async function AcessoBloqueadoPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSessionProfile("/acesso-bloqueado");
  const params = await searchParams;
  const app = Array.isArray(params.app) ? params.app[0] : params.app;

  return (
    <main>
      <AppNav />
      <section className="page-shell py-10">
        <AccessDenied appName={appNames[app ?? ""] ?? "este sistema"} backHref={safeNextPath(params.next, "/dashboard")} />
      </section>
    </main>
  );
}
