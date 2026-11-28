import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/geo/ui";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/planejamento")({
  head: () => pageHead("Planejamento de voo", "Planejamento de voo — MBA GeoMap."),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Planejamento de voo" />
      <Panel><p className="text-sm text-muted-foreground">Esta tela ainda será detalhada no protótipo.</p></Panel>
    </div>
  );
}