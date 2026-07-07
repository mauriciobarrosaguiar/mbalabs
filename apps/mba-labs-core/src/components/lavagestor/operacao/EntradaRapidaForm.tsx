"use client";

import { useState } from "react";
import { MessageBanner, SubmitButton } from "@/components/ui-kit";
import { createLavagemMelhorada } from "@/lib/actions/lavagestor-lavagem-actions";

type Cliente = {
  id: string;
  nome: string;
  telefone?: string;
};

type Veiculo = {
  id: string;
  cliente_id?: string;
  placa?: string;
  marca?: string;
  modelo?: string;
  cor?: string;
};

type Servico = {
  id: string;
  nome: string;
  preco?: number | null;
};

export function EntradaRapidaForm({
  clientes,
  veiculos,
  servicos,
  ok,
  error
}: {
  clientes: Cliente[];
  veiculos: Veiculo[];
  servicos: Servico[];
  ok?: string;
  error?: string;
}) {
  const [placa, setPlaca] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [veiculoMarca, setVeiculoMarca] = useState("");
  const [veiculoModelo, setVeiculoModelo] = useState("Veiculo");
  const [veiculoCor, setVeiculoCor] = useState("");
  const [servicoId, setServicoId] = useState(servicos[0]?.id ?? "");

  function applyCliente(cliente?: Cliente) {
    if (!cliente) return;
    setClienteId(cliente.id);
    setNome(cliente.nome || "");
    setTelefone(cliente.telefone || "");
  }

  function applyVeiculo(veiculo?: Veiculo) {
    if (!veiculo) return;
    setVeiculoId(veiculo.id);
    setPlaca(String(veiculo.placa || "").toUpperCase().replace(/\s/g, ""));
    setVeiculoMarca(veiculo.marca || "");
    setVeiculoModelo(veiculo.modelo || "Veiculo");
    setVeiculoCor(veiculo.cor || "");
    applyCliente(clientes.find((cliente) => cliente.id === veiculo.cliente_id));
  }

  function handlePlacaChange(value: string) {
    const next = value.toUpperCase().replace(/\s/g, "");
    setPlaca(next);
    const match = veiculos.find((veiculo) => normalPlate(veiculo.placa) === normalPlate(next));
    if (match) {
      applyVeiculo(match);
    } else {
      setVeiculoId("");
      setVeiculoMarca("");
      setVeiculoModelo("Veiculo");
      setVeiculoCor("");
    }
  }

  function handleNomeBlur() {
    const alvo = normalText(nome);
    if (!alvo) return;
    const match = clientes.find((cliente) => normalText(cliente.nome) === alvo) || clientes.find((cliente) => normalText(cliente.nome).includes(alvo));
    if (match) applyCliente(match);
  }

  function handleTelefoneBlur() {
    const alvo = onlyDigits(telefone);
    if (alvo.length < 8) return;
    const match = clientes.find((cliente) => onlyDigits(cliente.telefone).endsWith(alvo) || alvo.endsWith(onlyDigits(cliente.telefone)));
    if (match) applyCliente(match);
  }

  return (
    <form action={createLavagemMelhorada} encType="multipart/form-data" className="grid gap-3">
      <MessageBanner ok={ok} error={error} />

      <input type="hidden" name="return_to" value="/lavagestor/operacao/fila" />
      <input type="hidden" name="cliente_modo" value={clienteId ? "existente" : "novo"} />
      <input type="hidden" name="cliente_id" value={clienteId} />
      <input type="hidden" name="veiculo_modo" value={veiculoId ? "existente" : "novo"} />
      <input type="hidden" name="veiculo_id" value={veiculoId} />
      <input type="hidden" name="veiculo_tipo" value="carro" />
      <input type="hidden" name="veiculo_marca" value={veiculoMarca} />
      <input type="hidden" name="veiculo_modelo" value={veiculoModelo} />
      <input type="hidden" name="veiculo_cor" value={veiculoCor} />
      <input type="hidden" name="entrega_tipo" value="retirar" />
      <input type="hidden" name="valor_desconto" value="0" />
      <input type="hidden" name="descricao_extra" value="Entrada rapida" />

      <section className="grid gap-3 rounded-3xl border border-border bg-white p-4 shadow-sm">
        <h1 className="text-center text-2xl font-black">Entrada de veiculo</h1>

        <datalist id="placas-cadastradas">
          {veiculos.map((veiculo) => (
            <option key={veiculo.id} value={String(veiculo.placa || "")} />
          ))}
        </datalist>
        <datalist id="clientes-cadastrados">
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.nome} />
          ))}
        </datalist>

        <label className="grid gap-2">
          <span className="text-center text-lg font-black">Digite a placa</span>
          <input
            className="input min-h-14 text-center text-2xl font-black uppercase tracking-[0.12em]"
            name="veiculo_placa"
            list="placas-cadastradas"
            placeholder="ABC1D23"
            required
            value={placa}
            onBlur={() => applyVeiculo(veiculos.find((veiculo) => normalPlate(veiculo.placa) === normalPlate(placa)))}
            onChange={(event) => handlePlacaChange(event.target.value)}
          />
        </label>

        <Field label="Digite o nome do cliente" name="cliente_nome" list="clientes-cadastrados" placeholder="Nome do cliente" required value={nome} onBlur={handleNomeBlur} onChange={setNome} />
        <Field label="Digite o telefone do cliente" name="cliente_whatsapp" placeholder="WhatsApp / telefone" required inputMode="tel" value={telefone} onBlur={handleTelefoneBlur} onChange={setTelefone} />

        {clienteId ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-xs font-black text-emerald-900">Cliente cadastrado encontrado. Os dados foram puxados automaticamente.</p> : null}

        <label className="grid gap-2">
          <span className="text-center text-lg font-black">Tipo de servico</span>
          <select className="input min-h-14 text-center text-base font-bold" name="servico_id" required value={servicoId} onChange={(event) => setServicoId(event.target.value)}>
            {servicos.map((servico) => (
              <option key={servico.id} value={servico.id}>{servico.nome}</option>
            ))}
          </select>
        </label>

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
  inputMode,
  list,
  value,
  onBlur,
  onChange
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: "text" | "tel" | "decimal" | "numeric";
  list?: string;
  value: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-center text-lg font-black">{label}</span>
      <input className="input min-h-14 text-center text-base font-bold" name={name} list={list} placeholder={placeholder} required={required} inputMode={inputMode} value={value} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function normalPlate(value: unknown) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalText(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ");
}
