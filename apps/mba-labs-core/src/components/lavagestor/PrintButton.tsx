"use client";

export function PrintButton({ label = "Imprimir recibo" }: { label?: string }) {
  return (
    <button className="button-secondary print:hidden" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
