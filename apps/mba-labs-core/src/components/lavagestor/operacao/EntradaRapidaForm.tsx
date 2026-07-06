"use client";

import { useState } from "react";
import { MessageBanner, SubmitButton } from "@/components/ui-kit";
import { createLavagemMelhorada } from "@/lib/actions/lavagestor-lavagem-actions";

type Funcionario = {
  id: string;
  nome: string;
};

type Servico = {
  id: string;
  nome: string;
  preco?: number | null;
};

export function EntradaRapidaForm({
  funcionarios,
  servicos,
  ok,
  error
}: {
  funcionarios: Funcionario[];
  servicos: Servico[];
  ok?: string;
  error?: string;
}) {
  const [placa, setPlaca] = useState("");

  return (
    <form action={createLavagemMelhorada} className="grid gap-4">
      <MessageBanner ok={ok} error={error} />

      <input type="hidden" name="return_to" value="/lavagestor/operacao/fila" />
      <input type="hidden" name="cliente_modo" value="novo" />
      <input type="hidden" name="veiculo_modo" value="novo" />
      <input type="hidden" name="veiculo_tipo" value="carro" />
      <input type="hidden" name="veiculo_marca" value="" />
      <input type="hidden" name="veiculo_modelo" value="Veículo" />
      <input type="hidden" name="veiculo_cor" value="" />
      <input type="hidden" name="entrega_tipo" value="retirar" />
      <input type="hidden" name="valor_desconto" value="0" />
      <input type="hidden" name="descricao_extra" value="Entrada rápida" />

      <section className="rounded-3xl border border-border bg-white p-4 shadow-sm">
        <h1 className="text-2xl font-black">Entrada rápida</h1>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          Preencha só o essencial para colocar o veículo na fila.
        </p>

        <div className="mt-5 grid gap-4">
          <Field label="Nome do cliente" name="cliente_nome" placeholder="Ex.: João Silva" required />
          <Field label="Contato / WhatsApp" name="cliente_whatsapp" placeholder="Ex.: 63999999999" required inputMode="tel" />

          <label className="grid gap-2">
            <span className="text-sm font-black">Placa do veículo</span>
            <input
              className="input min-h-14 text-center text-2xl font-black uppercase tracking-[0.12em]"
              name="veiculo_placa"
              placeholder="ABC1D23"
              required
              value={placa}
              onChange={(event) => setPlaca(event.target.value.toUpperCase().replace(/\s/g, ""))}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-black">Serviço</span>
            <select className="input min-h-14 text-base font-bold" name="servico_id" required defaultValue="">
              <option value="">Selecione o serviço</option>
              {servicos.map((servico) => (
                <option key={servico.id} value={servico.id}>
                  {servico.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-black">Lavador</span>
            <select className="input min-h-14 text-base font-bold" name="funcionario_ids" required defaultValue="">
              <option value="">Selecione o lavador</option>
              {funcionarios.map((funcionario) => (
                <option key={funcionario.id} value={funcionario.id}>
                  {funcionario.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-black">Observação</span>
            <textarea className="input min-h-24 resize-y" name="observacoes" placeholder="Ex.: cliente pediu capricho nos bancos" />
          </label>
        </div>
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
      <span className="text-sm font-black">{label}</span>
      <input className="input min-h-14 text-base font-bold" name={name} placeholder={placeholder} required={required} inputMode={inputMode} />
    </label>
  );
}
