"use client";

import { useRef, useState } from "react";

type FieldKey = "ready" | "receipt";

type Props = {
  readyDefault: string;
  receiptDefault: string;
};

const variables = [
  { label: "Cliente", value: "{cliente}" },
  { label: "Veículo", value: "{veiculo}" },
  { label: "Total", value: "{total}" },
  { label: "Recibo", value: "{recibo}" },
  { label: "Entrega", value: "{entrega}" },
  { label: "Fotos", value: "{fotos}" }
];

export function MessageTemplateEditor({ readyDefault, receiptDefault }: Props) {
  const [activeField, setActiveField] = useState<FieldKey>("ready");
  const [ready, setReady] = useState(readyDefault);
  const [receipt, setReceipt] = useState(receiptDefault);
  const readyRef = useRef<HTMLTextAreaElement | null>(null);
  const receiptRef = useRef<HTMLTextAreaElement | null>(null);

  function insertVariable(variable: string) {
    const textarea = activeField === "ready" ? readyRef.current : receiptRef.current;
    const value = activeField === "ready" ? ready : receipt;
    const setter = activeField === "ready" ? setReady : setReceipt;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;
    const needsSpaceBefore = start > 0 && !/\s/.test(value[start - 1] ?? "");
    const needsSpaceAfter = end < value.length && !/\s|[.,!?]/.test(value[end] ?? "");
    const insert = `${needsSpaceBefore ? " " : ""}${variable}${needsSpaceAfter ? " " : ""}`;
    const next = `${value.slice(0, start)}${insert}${value.slice(end)}`;
    setter(next);

    window.requestAnimationFrame(() => {
      textarea?.focus();
      const cursor = start + insert.length;
      textarea?.setSelectionRange(cursor, cursor);
    });
  }

  function resetReady() {
    setReady("Olá, {cliente}! Seu veículo/item {veiculo} está pronto. Total: {total}. {entrega} {fotos}");
    setActiveField("ready");
    window.requestAnimationFrame(() => readyRef.current?.focus());
  }

  function resetReceipt() {
    setReceipt("Olá, {cliente}! Segue o recibo da lavagem {recibo}. Veículo/item: {veiculo}. Total pago: {total}. Obrigado pela preferência!");
    setActiveField("receipt");
    window.requestAnimationFrame(() => receiptRef.current?.focus());
  }

  return (
    <div className="grid gap-4 md:col-span-2">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-emerald-950">Variáveis clicáveis</p>
            <p className="mt-1 text-xs font-bold leading-5 text-emerald-900">Toque no campo onde deseja escrever, depois toque na variável para inserir no cursor.</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-800 shadow-sm">{activeField === "ready" ? "Veículo pronto" : "Recibo"}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {variables.map((item) => (
            <button
              className="rounded-full bg-white px-3 py-2 text-sm font-black text-emerald-800 shadow-sm active:scale-95"
              key={item.value}
              type="button"
              onClick={() => insertVariable(item.value)}
            >
              {item.value}
            </button>
          ))}
        </div>
      </div>

      <label className="grid gap-2">
        <span className="flex items-center justify-between gap-2 text-sm font-black">
          <span>Veículo pronto</span>
          <button className="text-xs font-black text-emerald-700" type="button" onClick={resetReady}>Restaurar padrão</button>
        </span>
        <textarea
          ref={readyRef}
          className={`input min-h-32 resize-y ${activeField === "ready" ? "ring-2 ring-emerald-200" : ""}`}
          name="mensagem_veiculo_pronto"
          value={ready}
          onChange={(event) => setReady(event.target.value)}
          onFocus={() => setActiveField("ready")}
        />
        <Preview text={ready} />
      </label>

      <label className="grid gap-2">
        <span className="flex items-center justify-between gap-2 text-sm font-black">
          <span>Recibo no WhatsApp</span>
          <button className="text-xs font-black text-emerald-700" type="button" onClick={resetReceipt}>Restaurar padrão</button>
        </span>
        <textarea
          ref={receiptRef}
          className={`input min-h-32 resize-y ${activeField === "receipt" ? "ring-2 ring-emerald-200" : ""}`}
          name="mensagem_recibo"
          value={receipt}
          onChange={(event) => setReceipt(event.target.value)}
          onFocus={() => setActiveField("receipt")}
        />
        <Preview text={receipt} />
      </label>
    </div>
  );
}

function Preview({ text }: { text: string }) {
  const preview = text
    .replaceAll("{cliente}", "João Cliente")
    .replaceAll("{veiculo}", "ABC1D23 - Fiat Palio")
    .replaceAll("{total}", "R$ 60,00")
    .replaceAll("{recibo}", "A1B2C3D4")
    .replaceAll("{entrega}", "Cliente retira")
    .replaceAll("{fotos}", "Fotos de entrada e checkout registradas.");

  return (
    <div className="rounded-xl border border-border bg-slate-50 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Prévia</p>
      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-900">{preview || "Digite a mensagem para ver a prévia."}</p>
    </div>
  );
}
