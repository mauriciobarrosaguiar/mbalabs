import { Menu } from "lucide-react";
import { Button } from "@/modules/cotacoes/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/modules/cotacoes/components/ui/sheet";
import { Separator } from "@/modules/cotacoes/components/ui/separator";
import { Sidebar, type SidebarNavItem } from "./sidebar";

export function MobileNav({
  items,
  currentPath,
  brand,
}: {
  items: SidebarNavItem[];
  currentPath: string;
  brand: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Abrir menu">
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        {brand}
        <Separator />
        <Sidebar items={items} currentPath={currentPath} />
      </SheetContent>
    </Sheet>
  );
}
