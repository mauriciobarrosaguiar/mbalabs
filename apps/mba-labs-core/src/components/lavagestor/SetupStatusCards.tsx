type SetupStatusCardsProps = {
  cards: {
    ia: string;
    whatsapp: string;
    envio: string;
    final: string;
  };
};

export function SetupStatusCards({ cards }: SetupStatusCardsProps) {
  const items = [
    { label: "IA", value: cards.ia },
    { label: "WhatsApp", value: cards.whatsapp },
    { label: "Envio automatico", value: cards.envio },
    { label: "Status final", value: cards.final }
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div className={`min-w-0 rounded-xl border p-3 shadow-sm ${tone(item.value)}`} key={item.label}>
          <p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">{item.label}</p>
          <strong className="mt-2 block break-words text-xl font-black">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function tone(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("pronto") || lower.includes("ativada") || lower.includes("conectado")) return "border-emerald-200 bg-emerald-50";
  if (lower.includes("erro")) return "border-red-200 bg-red-50";
  if (lower.includes("aguardando") || lower.includes("aprovacao")) return "border-amber-200 bg-amber-50";
  return "border-border bg-white";
}
