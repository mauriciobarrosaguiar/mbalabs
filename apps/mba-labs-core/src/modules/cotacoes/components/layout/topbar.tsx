import { Button } from "@/modules/cotacoes/components/ui/button";
import { ModeBadge } from "./mode-badge";

export function Topbar({
  title,
  subtitle,
  mobileNav,
}: {
  title: string;
  subtitle: string;
  mobileNav?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          {mobileNav}
          <div>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
            <h1 className="text-xl font-semibold tracking-normal text-slate-950">
              {title}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ModeBadge />
          <form action="/sair" method="post">
            <Button variant="outline" size="sm" type="submit">
              Sair
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
