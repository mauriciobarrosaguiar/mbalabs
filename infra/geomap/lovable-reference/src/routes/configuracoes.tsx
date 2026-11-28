import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/geo/ui";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/configuracoes")({
  head: () => pageHead("Configurações", "Configurações — MBA GeoMap."),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Configurações" />
      <Panel><p className="text-sm text-muted-foreground">Esta tela ainda será detalhada no protótipo.</p></Panel>
    </div>
  );
}