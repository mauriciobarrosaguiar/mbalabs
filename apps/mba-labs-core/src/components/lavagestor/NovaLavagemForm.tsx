"use client";

import { useMemo, useState } from "react";
import { BackButton, MessageBanner, SubmitButton } from "@/components/ui-kit";
import { createLavagemMelhorada } from "@/lib/actions/lavagestor-lavagem-actions";

type Cliente = {
  id: string;
  nome: string;
};

type Veiculo = {
  id: string;
  cliente_id: string;
  placa?: string | null;
  marca?: string | null;
  modelo?: string | null;
  cor?: string | null;
  tipo?: string | null;
};

type Funcionario = {
  id: string;
  nome: string;
  percentual_comissao?: number | null;
};

type Servico = {
  id: string;
  nome: string;
  preco?: number | null;
  percentual_comissao?: number | null;
};

type Props = {
  clientes: Cliente[];
  veiculos: Veiculo[];
  funcionarios: Funcionario[];
  servicos: Servico[];
  ok?: string;
  error?: string;
};

const modelosPorMarca: Record<string, string[]> = {
  Chevrolet: ["Onix", "Prisma", "Celta", "Corsa", "S10", "Tracker", "Spin"],
  Fiat: ["Palio", "Uno", "Mobi", "Argo", "Strada", "Toro", "Cronos", "Siena"],
  Ford: ["Ka", "Fiesta", "EcoSport", "Ranger", "Fusion"],
  Honda: ["Civic", "Fit", "City", "HR-V", "WR-V"],
  Hyundai: ["HB20", "Creta", "Tucson", "ix35", "Santa Fe"],
  Jeep: ["Renegade", "Compass", "Commander"],
  Nissan: ["March", "Versa", "Kicks", "Frontier"],
  Renault: ["Kwid", "Sandero", "Logan", "Duster", "Oroch"],
  Toyota: ["Corolla", "Hilux", "SW4", "Etios", "Yaris", "Corolla Cross"],
  Volkswagen: ["Gol", "Voyage", "Fox", "Polo", "Virtus", "Saveiro", "T-Cross", "Nivus"],
  Outra: ["Outro modelo"]
};

const tipos = [
  { label: "Carro", value: "carro" },
  { label: "Moto", value: "moto" },
  { label: "Caminhonete", value: "caminhonete" },
  { label: "Caminhão", value: "caminhao" },
  { label: "Sofá", value: "sofa" },
  { label: "Tapete", value: "tapete" },
  { label: "Máquina", value: "maquina" },
  { label: "Outro", value: "outro" }
];

export function NovaLavagemForm({ clientes, veiculos, funcionarios, servicos, ok, error }: Props) {
  const [clienteId, setClienteId] = useState("");
  const [tipo, setTipo] = useState("carro");
  const [marca, setMarca] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [adicionais, setAdicionais] = useState<string[]>([]);
  const [lavadores, setLavadores] = useState<string[]>([]);
  const [desconto, setDesconto] = useState("0");

  const veiculosDoCliente = useMemo(() => veiculos.filter((veiculo) => veiculo.cliente_id === clienteId), [clienteId, veiculos]);
  const servicoPrincipal = servicos.find((servico) => servico.id === servicoId);
  const servicosAdicionais = servicos.filter((servico) => adicionais.includes(servico.id));
  const totalBruto = roundMoney(Number(servicoPrincipal?.preco ?? 0) + servicosAdicionais.reduce((total, item) => total + Number(item.preco ?? 0), 0));
  const valorDesconto = parseMoney(desconto);
  const totalFinal = roundMoney(Math.max(totalBruto - valorDesconto, 0));
  const primeiroLavador = funcionarios.find((funcionario) => funcionario.id === lavadores[0]);
  const percentualPadrao = Number(primeiroLavador?.percentual_comissao ?? 0);
  const comissaoTotal = roundMoney([servicoPrincipal, ...servicosAdicionais].filter(Boolean).reduce((total, servico) => {
    const item = servico as Servico;
    const percent = item.percentual_comissao === null || item.percentual_comissao === undefined ? percentualPadrao : Number(item.percentual_comissao ?? 0);
    return total + (Number(item.preco ?? 0) * percent) / 100;
  }, 0));
  const comissaoPorLavador = lavadores.length > 0 ? roundMoney(comissaoTotal / lavadores.length) : 0;
  const isCarLike = ["carro", "moto", "caminhonete", "caminhao"].includes(tipo);
  const modelos = marca ? modelosPorMarca[marca] ?? [] : [];

  function handleServicoPrincipal(value: string) {
    setServicoId(value);
    const servico = servicos.find((item) => item.id === value);
    const nome = normalizeText(servico?.nome ?? "");

    if (nome.includes("sofa")) setTipo("sofa");
    if (nome.includes("tapete")) setTipo("tapete");
    if (nome.includes("moto")) setTipo("moto");
    if (nome.includes("caminhonete")) setTipo("caminhonete");
    if (nome.includes("caminhao")) setTipo("caminhao");
    if (nome.includes("carro")) setTipo("carro");
  }

  function toggleAdicional(id: string) {
    setAdicionais((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleLavador(id: string) {
    setLavadores((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <form action={createLavagemMelhorada} className="grid gap-5">
      <MessageBanner ok={ok} error={error} />

      <Step title="1. Cliente" description="Selecione um cliente existente ou cadastre rapidamente.">
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-bold">Cliente existente</span>
          <select className="input" name="cliente_id" value={clienteId} onChange={(event) => setClienteId(event.target.value)}>
            <option value="">Selecione</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>
            ))}
          </select>
        </label>
        <Field label="Novo cliente" name="cliente_nome" placeholder="Nome do cliente" />
        <Field label="WhatsApp" name="cliente_whatsapp" placeholder="5599999999999" />
        <Textarea label="Observação do cliente" name="cliente_observacao" />
      </Step>

      <Step title="2. Veículo ou item" description="O veículo existente só aparece depois de escolher o cliente. Para sofá, tapete ou máquina, os dados de carro são ocultados.">
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-bold">Veículo existente</span>
          <select className="input" name="veiculo_id" disabled={!clienteId || veiculosDoCliente.length === 0} defaultValue="">
            <option value="">{clienteId ? "Selecione" : "Selecione primeiro o cliente"}</option>
            {veiculosDoCliente.map((veiculo) => (
              <option key={veiculo.id} value={veiculo.id}>{vehicleLabel(veiculo)}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-bold">Tipo</span>
          <select className="input" name="veiculo_tipo" value={tipo} onChange={(event) => setTipo(event.target.value)}>
            {tipos.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        {isCarLike ? (
          <>
            <Field label="Placa" name="veiculo_placa" placeholder="ABC1D23" />
            <label className="grid gap-2">
              <span className="text-sm font-bold">Marca</span>
              <select className="input" name="veiculo_marca" value={marca} onChange={(event) => setMarca(event.target.value)}>
                <option value="">Selecione</option>
                {Object.keys(modelosPorMarca).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold">Modelo</span>
              <select className="input" name="veiculo_modelo" disabled={!marca} defaultValue="">
                <option value="">{marca ? "Selecione" : "Selecione a marca"}</option>
                {modelos.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <Field label="Cor" name="veiculo_cor" />
          </>
        ) : (
          <>
            <input type="hidden" name="veiculo_placa" value="" />
            <input type="hidden" name="veiculo_marca" value="" />
            <Field label="Descrição do item" name="veiculo_modelo" placeholder={tipo === "sofa" ? "Ex.: Sofá 3 lugares" : "Ex.: Tapete grande"} />
            <input type="hidden" name="veiculo_cor" value="" />
          </>
        )}
        <Textarea label="Observação do veículo/item" name="veiculo_observacao" />
      </Step>

      <Step title="3. Serviços e lavadores" description="O serviço puxa o valor cadastrado. Se houver mais de um lavador, a comissão é dividida igualmente.">
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-bold">Serviço cadastrado</span>
          <select className="input" name="servico_id" value={servicoId} onChange={(event) => handleServicoPrincipal(event.target.value)} required>
            <option value="">Selecione</option>
            {servicos.map((servico) => (
              <option key={servico.id} value={servico.id}>{servico.nome} - {formatMoney(servico.preco)}</option>
            ))}
          </select>
        </label>
        <ReadOnlyMoney label="Valor do serviço" value={Number(servicoPrincipal?.preco ?? 0)} />

        <div className="grid gap-2 md:col-span-2">
          <span className="text-sm font-bold">Lavadores responsáveis</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {funcionarios.map((funcionario) => (
              <label key={funcionario.id} className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-3 text-sm font-semibold">
                <input type="checkbox" name="funcionario_ids" value={funcionario.id} checked={lavadores.includes(funcionario.id)} onChange={() => toggleLavador(funcionario.id)} />
                <span>{funcionario.nome}</span>
              </label>
            ))}
          </div>
          {lavadores[0] ? <input type="hidden" name="funcionario_id" value={lavadores[0]} /> : null}
        </div>

        <div className="grid gap-2 md:col-span-2">
          <span className="text-sm font-bold">Serviços adicionais</span>
          <div className="grid gap-2">
            {servicos.filter((servico) => servico.id !== servicoId).map((servico) => (
              <label key={servico.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-3 text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <input type="checkbox" name="servico_adicional_ids" value={servico.id} checked={adicionais.includes(servico.id)} onChange={() => toggleAdicional(servico.id)} />
                  {servico.nome}
                </span>
                <strong>{formatMoney(servico.preco)}</strong>
              </label>
            ))}
          </div>
        </div>

        <Textarea label="Descrição extra" name="descricao_extra" />
      </Step>

      <Step title="4. Valores" description="O total é calculado com base no serviço principal e nos adicionais. O pagamento será registrado depois, pela fila.">
        <input type="hidden" name="valor_servico" value={String(Number(servicoPrincipal?.preco ?? 0))} />
        <input type="hidden" name="valor_total" value={String(totalBruto)} />
        <input type="hidden" name="valor_final" value={String(totalFinal)} />
        <ReadOnlyMoney label="Total bruto" value={totalBruto} />
        <label className="grid gap-2">
          <span className="text-sm font-bold">Desconto</span>
          <input className="input" inputMode="decimal" name="valor_desconto" placeholder="0,00" value={desconto} onChange={(event) => setDesconto(event.target.value)} />
        </label>
        <ReadOnlyMoney label="Total final" value={totalFinal} />
        <ReadOnlyMoney label="Comissão total" value={comissaoTotal} />
        <ReadOnlyMoney label="Comissão por lavador" value={comissaoPorLavador} />
        <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground md:col-span-2">
          O status de pagamento ficará como <strong>Aberto</strong>. Depois que a lavagem estiver na fila, registre pagamento, fiado ou parcial.
        </p>
        <Textarea label="Observações da entrada" name="observacoes" />
      </Step>

      <div className="panel grid gap-3 p-5">
        <h2 className="text-xl font-black">5. Confirmar entrada</h2>
        <p className="text-sm leading-6 text-slate-300">
          Ao confirmar, a lavagem entra com status <strong>Na fila</strong> e pagamento <strong>Aberto</strong>.
        </p>
        <div className="flex flex-wrap gap-2">
          <SubmitButton>Confirmar entrada</SubmitButton>
          <BackButton href="/lavagestor/fila" label="Ver fila" />
        </div>
      </div>
    </form>
  );
}

function Step({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="panel grid gap-4 p-5">
      <div>
        <h2 className="text-xl font-black">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, name, placeholder }: { label: string; name: string; placeholder?: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold">{label}</span>
      <input className="input" name={name} placeholder={placeholder} />
    </label>
  );
}

function Textarea({ label, name }: { label: string; name: string }) {
  return (
    <label className="grid gap-2 md:col-span-2">
      <span className="text-sm font-bold">{label}</span>
      <textarea className="input min-h-24 resize-y" name={name} />
    </label>
  );
}

function ReadOnlyMoney({ label, value }: { label: string; value: number }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold">{label}</span>
      <input className="input bg-muted font-black" value={formatMoney(value)} readOnly />
    </label>
  );
}

function vehicleLabel(veiculo: Veiculo) {
  return [veiculo.placa || "Sem placa", [veiculo.marca, veiculo.modelo].filter(Boolean).join(" "), veiculo.cor].filter(Boolean).join(" - ");
}

function formatMoney(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseMoney(value: string) {
  return Number(String(value || "0").replace(/\./g, "").replace(",", ".")) || 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
