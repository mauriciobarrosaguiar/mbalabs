"use client";

import { useState } from "react";
import { MessageBanner, SubmitButton } from "@/components/ui-kit";
import { createLavagemMelhorada } from "@/lib/actions/lavagestor-lavagem-actions";

type Servico = {
  id: string;
  nome: string;
  preco?: number | null;
};

export function EntradaRapidaForm({
  servicos,
  ok,
  error
}: {
  servicos: Servico[];
  ok?: string;
  error?: string;
}) {
  const [placa, setPlaca] = useState("");
  const servicoPadrao = servicos[0];

  return (
    <form action={createLavagemMelhorada} encType="multipart/form-data" className="grid gap-3">
      <MessageBanner ok={ok} error={error} />

      <input type="hidden" name="return_to" value="/lavagestor/operacao/fila" />
      <input type="hidden" name="cliente_modo" value="novo" />
      <input type="hidden" name="veiculo_modo" value="novo" />
      <input type="hidden" name="veiculo_tipo" value="carro" />
      <input type="hidden" name="veiculo_marca" value="" />
      <input type="hidden" name="veiculo_modelo" value="Veiculo" />
      <input type="hidden" name="veiculo_cor" value="" />
      <input type="hidden" name="entrega_tipo" value="retirar" />
      <input type="hidden" name="valor_desconto" value="0" />
      <input type="hidden" name="descricao_extra" value="Entrada rapida" />
      <input type="hidden" name="servico_id" value={servicoPadrao?.id ?? ""} />

      <section className="grid gap-3 rounded-3xl border border-border bg-white p-4 shadow-sm">
        <h1 className="text-center text-2xl font-black">Entrada de veiculo</h1>

        <label className="grid gap-2">
          <span className="text-center text-lg font-black">Digite a placa</span>
          <input
            className="input min-h-14 text-center text-2xl font-black uppercase tracking-[0.12em]"
            name="veiculo_placa"
            placeholder="ABC1D23"
            required
            value={placa}
            onChange={(event) => setPlaca(event.target.value.toUpperCase().replace(/\s/g, ""))}
          />
        </label>

        <Field label="Digite o nome do cliente" name="cliente_nome" placeholder="Nome do cliente" required />
        <Field label="Digite o telefone do cliente" name="cliente_whatsapp" placeholder="WhatsApp / telefone" required inputMode="tel" />

        <label className="grid gap-2">
          <span className="text-center text-lg font-black">Foto da placa</span>
          <input className="input min-h-14 bg-white text-sm font-bold" name="foto_placa" type="file" accept="image/*" capture="environment" />
        </label>
      </section>

      <SubmitButton>Salvar entrada</SubmitButton>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  required = false,
  inputMode
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: "text" | "tel" | "decimal" | "numeric";
}) {
  return (
    <label className="grid gap-2">
      <span className="text-center text-lg font-black">{label}</span>
      <input className="input min-h-14 text-center text-base font-bold" name={name} placeholder={placeholder} required={required} inputMode={inputMode} />
    </label>
  );
}
