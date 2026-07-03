"use client";

import { useMemo, useState } from "react";
import { SubmitButton, formatMoney } from "@/components/ui-kit";
import { saveLavaAgendamento } from "@/lib/actions/lavagestor-agendamentos-actions";

type Row = Record<string, unknown>;

type Props = {
  clientes: Row[];
  veiculos: Row[];
  servicos: Row[];
  funcionarios: Row[];
  config: Row;
};

export function AgendamentoForm({ clientes, veiculos, servicos, funcionarios, config }: Props) {
  const [clienteId, setClienteId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [manualHour, setManualHour] = useState(false);
  const filteredVehicles = useMemo(() => veiculos.filter((row) => String(row.cliente_id ?? "") === clienteId), [clienteId, veiculos]);
  const selectedService = servicos.find((row) => String(row.id) === servicoId);
  const hourOptions = useMemo(() => buildHourOptions(config), [config]);
  const today = new Date().toISOString().slice(0, 10);

  function handleServiceChange(value: string) {
    setServicoId(value);
    const service = servicos.find((row) => String(row.id) === value);
    if (!titulo.trim() && service?.nome) setTitulo(String(service.nome));
  }

  return (
    <form action={saveLavaAgendamento} className="grid gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
      <h2 className="text-xl font-black">Criar agendamento</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2">
          <span className="text-sm font-black">Cliente</span>
          <select className="input" name="cliente_id" required value={clienteId} onChange={(event) => { setClienteId(event.target.value); setVeiculoId(""); }}>
            <option value="">Selecione</option>
            {clientes.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.nome)}</option>)}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-black">Veículo</span>
          <select className="input" name="veiculo_id" required value={veiculoId} onChange={(event) => setVeiculoId(event.target.value)} disabled={!clienteId}>
            <option value="">{clienteId ? "Selecione" : "Escolha o cliente primeiro"}</option>
            {filteredVehicles.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.veiculo)}</option>)}
            {clienteId ? <option value="__novo__">Cadastrar novo veículo</option> : null}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-black">Serviço</span>
          <select className="input" name="servico_id" required value={servicoId} onChange={(event) => handleServiceChange(event.target.value)}>
            <option value="">Selecione</option>
            {servicos.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.nome)} - {formatMoney(row.preco)}</option>)}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-black">Funcionário</span>
          <select className="input" name="funcionario_id">
            <option value="">Definir depois</option>
            {funcionarios.map((row) => <option key={String(row.id)} value={String(row.id)}>{String(row.nome)}</option>)}
          </select>
        </label>

        {veiculoId === "__novo__" ? (
          <div className="grid gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3 md:col-span-2 xl:col-span-4">
            <p className="text-sm font-black text-emerald-950">Novo veículo</p>
            <div className="grid gap-3 md:grid-cols-4">
              <Input label="Placa" name="novo_veiculo_placa" maxLength={8} />
              <Input label="Marca" name="novo_veiculo_marca" />
              <Input label="Modelo" name="novo_veiculo_modelo" />
              <Input label="Cor" name="novo_veiculo_cor" />
            </div>
            <input name="novo_veiculo_tipo" type="hidden" value="carro" />
          </div>
        ) : null}

        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-black">Titulo</span>
          <input className="input" name="titulo" placeholder="Ex.: Lavagem completa" value={titulo} onChange={(event) => setTitulo(event.target.value)} />
        </label>
        <Input label="Data" name="data" type="date" defaultValue={today} required />

        <label className="grid gap-2">
          <span className="text-sm font-black">Hora</span>
          <select className="input" name="hora" required={!manualHour} onChange={(event) => setManualHour(event.target.value === "__manual__")}>
            {hourOptions.map((item) => <option key={item} value={item}>{item}</option>)}
            <option value="__manual__">Digitar horário</option>
          </select>
        </label>

        {manualHour ? <Input label="Hora manual" name="hora_manual" type="time" required /> : <input name="hora_manual" type="hidden" value="" />}
        <Input label="Duração (min)" name="duracao_min" type="number" defaultValue="60" />

        {selectedService?.nome ? (
          <div className="rounded-lg bg-muted px-3 py-2 text-sm font-semibold text-muted-foreground md:col-span-2 xl:col-span-4">
            Serviço selecionado: {String(selectedService.nome)} - {formatMoney(selectedService.preco)}
          </div>
        ) : null}

        <label className="grid gap-2 md:col-span-2 xl:col-span-4">
          <span className="text-sm font-black">Adicional / observação curta</span>
          <input className="input" name="adicional_texto" placeholder="Ex.: cliente pediu aspiração reforçada" />
        </label>

        <label className="grid gap-2 md:col-span-2 xl:col-span-4">
          <span className="text-sm font-black">Observação</span>
          <textarea className="input min-h-20" name="observacao" />
        </label>
      </div>
      <div className="w-fit">
        <SubmitButton>Salvar agendamento</SubmitButton>
      </div>
    </form>
  );
}

function Input({
  label,
  name,
  type = "text",
  required = false,
  defaultValue,
  maxLength
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  maxLength?: number;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black">{label}</span>
      <input className="input" name={name} type={type} required={required} defaultValue={defaultValue} maxLength={maxLength} />
    </label>
  );
}

function buildHourOptions(config: Row) {
  const start = parseHour(String(config.horario_abertura ?? "08:00"));
  const end = parseHour(String(config.horario_fechamento ?? "18:00"));
  const step = Number(config.intervalo_agenda_min ?? 30);
  const safeStep = Number.isFinite(step) && step >= 10 ? step : 30;
  const options: string[] = [];
  for (let minutes = start; minutes <= end; minutes += safeStep) {
    options.push(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
  }
  return options.length ? options : ["08:00", "08:30", "09:00", "09:30", "10:00"];
}

function parseHour(value: string) {
  const [hour, minute] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 8 * 60;
  return hour * 60 + minute;
}
