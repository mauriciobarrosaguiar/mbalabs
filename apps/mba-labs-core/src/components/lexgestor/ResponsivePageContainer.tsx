import { ReactNode } from "react";

type ResponsivePageContainerProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function ResponsivePageContainer({
  title,
  description,
  action,
  children,
}: ResponsivePageContainerProps) {
  return (
    <main className="page-container">
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="stack">{children}</div>
    </main>
  );
}
