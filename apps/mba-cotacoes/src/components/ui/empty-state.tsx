import type { LucideIcon } from "lucide-react";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  icon: Icon = FileQuestion,
  action,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-white p-8 text-center">
      <Icon className="h-10 w-10 text-teal-700" />
      <h3 className="mt-4 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function BackToDemoButton({ href }: { href: string }) {
  return (
    <Button asChild variant="outline">
      <a href={href}>Usar dados demo</a>
    </Button>
  );
}
