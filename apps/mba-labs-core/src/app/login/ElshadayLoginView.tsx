import type { ReactNode } from "react";

export function ElshadayAuthView({
  children,
  churchName,
  location,
  subtitle,
  title
}: {
  children: ReactNode;
  churchName: string;
  location: string;
  subtitle: string;
  title: string;
}) {
  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#f3f6f1] text-slate-900 [color-scheme:light]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col justify-start px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:justify-center sm:px-6 sm:py-8">
        <header className="flex flex-col items-center px-2 pb-5 pt-1 text-center sm:pb-6">
          <img
            alt="Elshaday"
            className="size-28 rounded-[28px] object-cover shadow-[0_14px_36px_rgba(6,28,67,.24)] ring-1 ring-[#d7b458]/25"
            height="112"
            src="/elshaday/logo.svg"
            width="112"
          />
          <h1 className="mt-4 text-[1.65rem] font-black leading-tight tracking-[-0.025em] text-[#123d2d] sm:text-3xl">
            {churchName}
          </h1>
          <p className="mt-1.5 text-sm font-bold text-[#6f592d]">{location}</p>
        </header>

        <section className="w-full rounded-[26px] border border-[#123d2d]/10 bg-white p-5 shadow-[0_22px_60px_rgba(18,61,45,.13)] sm:p-7">
          <div className="mb-5 text-center">
            <h2 className="text-2xl font-black tracking-tight text-slate-950">{title}</h2>
            <p className="mt-1 text-base text-slate-600">{subtitle}</p>
          </div>

          {children}
        </section>
      </div>
    </main>
  );
}
