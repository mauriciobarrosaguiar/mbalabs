import { Inbox } from "lucide-react";

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <Inbox size={30} color="var(--primary)" aria-hidden />
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}
