import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/geo/ui";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/servidores")({
  head: () => pageHead("Servidores de processamento", "Servidores de processamento — MBA GeoMap."),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Servidores de processamento" />
      <Panel><p className="text-sm text-muted-foreground">Esta tela ainda será detalhada no protótipo.</p></Panel>
    </div>
  );
}