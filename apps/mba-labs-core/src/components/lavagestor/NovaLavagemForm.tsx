"use client";

import { useMemo, useState } from "react";
import { BackButton, MessageBanner, SubmitButton } from "@/components/ui-kit";
import { createLavagemMelhorada } from "@/lib/actions/lavagestor-lavagem-actions";

type Cliente = {
  id: string;
  nome: string;
  telefone?: string | null;
  observacao?: string | null;
};

type Veiculo = {
  id: string;
  cliente_id: string;
  placa?: string | null;
  marca?: string | null;
  modelo?: string | null;
  cor?: string | null;
  tipo?: string | null;
  observacao?: string | null;
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
  tipo?: string | null;
  aplicacao?: string | null;
  categoria?: string | null;
  adicional?: boolean | null;
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

const carLikeTypes = ["carro", "moto", "caminhonete", "caminhao"];

export function NovaLavagemForm({ clientes, veiculos, funcionarios, servicos, ok, error }: Props) {
  const [clienteModo, setClienteModo] = useState<"existente" | "novo">("existente");
  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteWhatsapp, setClienteWhatsapp] = useState("");
  const [clienteObservacao, setClienteObservacao] = useState("");
  const [veiculoModo, setVeiculoModo] = useState<"existente" | "novo">("existente");
  const [veiculoId, setVeiculoId] = useState("");
  const [tipo, setTipo] = useState("carro");
  const [placa, setPlaca] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [cor, setCor] = useState("");
  const [veiculoObservacao, setVeiculoObservacao] = useState("");
  const [entregaTipo, setEntregaTipo] = useState<"retirar" | "levar">("retirar");
  const [servicoId, setServicoId] = useState("");
  const [adicionais, setAdicionais] = useState<string[]>([]);
  const [lavadores, setLavadores] = useState<string[]>([]);
  const [desconto, setDesconto] = useState("0");

  const tipoNormalizado = normalizeTipo(tipo);
  const veiculosDoCliente = useMemo(() => veiculos.filter((veiculo) => veiculo.cliente_id === clienteId), [clienteId, veiculos]);
  const servicosPrincipais = useMemo(() => {
    const principais = servicos.filter(isPrincipal);
    const porTipo = principais.filter((servico) => serviceMatchesType(servico, tipoNormalizado));
    return porTipo.length > 0 ? porTipo : principais;
  }, [servicos, tipoNormalizado]);
  const servicosAdicionaisDisponiveis = useMemo(() => {
    const adicionaisAtivos = servicos.filter((servico) => isAdicional(servico) && servico.id !== servicoId);
    const porTipo = adicionaisAtivos.filter((servico) => serviceMatchesType(servico, tipoNormalizado));
    return porTipo.length > 0 ? porTipo : adicionaisAtivos;
  }, [servicos, tipoNormalizado, servicoId]);
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
  const isCarLike = isCarLikeTipo(tipoNormalizado);
  const modelos = marca ? modelosPorMarca[marca] ?? [] : [];

  function handleClienteModo(value: "existente" | "novo") {
    setClienteModo(value);
    setClienteId("");
    setClienteNome("");
    setClienteWhatsapp("");
    setClienteObservacao("");
    setVeiculoModo(value === "novo" ? "novo" : "existente");
    clearVeiculo();
  }

  function handleCliente(value: string) {
    setClienteId(value);
    const cliente = clientes.find((item) => item.id === value);
    setClienteNome(cliente?.nome ?? "");
    setClienteWhatsapp(cliente?.telefone ?? "");
    setClienteObservacao(cliente?.observacao ?? "");
    clearVeiculo();
  }

  function handleVeiculoModo(value: "existente" | "novo") {
    setVeiculoModo(value);
    clearVeiculo();
  }

  function handleVeiculo(value: string) {
    setVeiculoId(value);
    const veiculo = veiculos.find((item) => item.id === value);
    setTipo(normalizeTipo(veiculo?.tipo || "carro"));
    setPlaca(veiculo?.placa ?? "");
    setMarca(veiculo?.marca ?? "");
    setModelo(veiculo?.modelo ?? "");
    setCor(veiculo?.cor ?? "");
    setVeiculoObservacao(veiculo?.observacao ?? "");
    setServicoId("");
    setAdicionais([]);
  }

  function handleTipo(value: string) {
    const normalized = normalizeTipo(value);
    setTipo(normalized);
    setServicoId("");
    setAdicionais([]);
    if (!isCarLikeTipo(normalized)) {
      setPlaca("");
      setMarca("");
      setModelo("");
      setCor("");
    }
  }

  function handleMarca(value: string) {
    setMarca(value);
    setModelo("");
  }

  function handleServicoPrincipal(value: string) {
    setServicoId(value);
    const servico = servicos.find((item) => item.id === value);
    const aplicacao = normalizeTipo(servico?.aplicacao ?? "");
    if (aplicacao && aplicacao !== "todos") {
      setTipo(aplicacao);
    }
  }

  function toggleAdicional(id: string) {
    setAdicionais((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleLavador(id: string) {
    setLavadores((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function clearVeiculo() {
    setVeiculoId("");
    setTipo("carro");
    setPlaca("");
    setMarca("");
    setModelo("");
    setCor("");
    setVeiculoObservacao("");
    setServicoId("");
    setAdicionais([]);
  }

  return (
    <form action={createLavagemMelhorada} className="grid gap-5">
      <MessageBanner ok={ok} error={error} />

      <Step title="1. Cliente" description="Escolha se é cliente existente ou cliente novo. Se for existente, os dados aparecem editáveis.">
        <SegmentedChoice
          label="Tipo de cliente"
          name="cliente_modo"
          value={clienteModo}
          onChange={(value) => handleClienteModo(value as "existente" | "novo")}
          options={[
            { label: "Cliente existente", value: "existente" },
            { label: "Cliente novo", value: "novo" }
          ]}
        />

        {clienteModo === "existente" ? (
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-bold">Escolher cliente</span>
            <select className="input" name="cliente_id" value={clienteId} onChange={(event) => handleCliente(event.target.value)} required>
              <option value="">Selecione o cliente</option>
              {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
            </select>
          </label>
        ) : null}

        <Field label={clienteModo === "existente" ? "Nome do cliente" : "Novo cliente"} name="cliente_nome" value={clienteNome} onChange={setClienteNome} placeholder="Nome do cliente" required={clienteModo === "novo"} />
        <Field label="WhatsApp" name="cliente_whatsapp" value={clienteWhatsapp} onChange={setClienteWhatsapp} placeholder="5599999999999" required={clienteModo === "novo"} />
        <Textarea label="Observação do cliente" name="cliente_observacao" value={clienteObservacao} onChange={setClienteObservacao} />
      </Step>

      <Step title="2. Veículo ou item" description="Escolha veículo existente ou cadastre um novo. Veículo existente só aparece depois do cliente.">
        <SegmentedChoice
          label="Tipo de veículo/item"
          name="veiculo_modo"
          value={veiculoModo}
          onChange={(value) => handleVeiculoModo(value as "existente" | "novo")}
          options={[
            { label: "Existente", value: "existente" },
            { label: "Novo", value: "novo" }
          ]}
        />

        {veiculoModo === "existente" ? (
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-bold">Escolher veículo/item</span>
            <select className="input" name="veiculo_id" disabled={!clienteId || veiculosDoCliente.length === 0} value={veiculoId} onChange={(event) => handleVeiculo(event.target.value)} required={veiculoModo === "existente"}>
              <option value="">{clienteId ? "Selecione" : "Selecione primeiro o cliente"}</option>
              {veiculosDoCliente.map((veiculo) => <option key={veiculo.id} value={veiculo.id}>{vehicleLabel(veiculo)}</option>)}
            </select>
            {clienteId && veiculosDoCliente.length === 0 ? <span className="text-xs font-semibold text-muted-foreground">Este cliente ainda não tem veículo cadastrado. Selecione “Novo”.</span> : null}
          </label>
        ) : null}

        <label className="grid gap-2">
          <span className="text-sm font-bold">Tipo</span>
          <select className="input" name="veiculo_tipo" value={tipoNormalizado} onChange={(event) => handleTipo(event.target.value)}>
            {tipos.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>

        {isCarLike ? (
          <>
            <Field label="Placa" name="veiculo_placa" value={placa} onChange={setPlaca} placeholder="ABC1D23" />
            <label className="grid gap-2">
              <span className="text-sm font-bold">Marca</span>
              <select className="input" name="veiculo_marca" value={marca} onChange={(event) => handleMarca(event.target.value)}>
                <option value="">Selecione</option>
                {Object.keys(modelosPorMarca).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-bold">Modelo</span>
              <select className="input" name="veiculo_modelo" disabled={!marca} value={modelo} onChange={(event) => setModelo(event.target.value)}>
                <option value="">{marca ? "Selecione" : "Selecione a marca"}</option>
                {modelos.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <Field label="Cor" name="veiculo_cor" value={cor} onChange={setCor} />
          </>
        ) : (
          <>
            <input type="hidden" name="veiculo_placa" value="" />
            <input type="hidden" name="veiculo_marca" value="" />
            <Field label="Descrição do item" name="veiculo_modelo" value={modelo} onChange={setModelo} placeholder={tipoNormalizado === "sofa" ? "Ex.: Sofá 3 lugares" : "Ex.: Tapete grande"} />
            <input type="hidden" name="veiculo_cor" value="" />
          </>
        )}
        <Textarea label="Observação do veículo/item" name="veiculo_observacao" value={veiculoObservacao} onChange={setVeiculoObservacao} />
      </Step>

      <Step title="3. Entrega" description="Defina se o cliente irá retirar ou se o lava-jato vai levar. Isso muda a mensagem do WhatsApp.">
        <SegmentedChoice
          label="Entrega"
          name="entrega_tipo"
          value={entregaTipo}
          onChange={(value) => setEntregaTipo(value as "retirar" | "levar")}
          options={[
            { label: "Cliente retira", value: "retirar" },
            { label: "Levar ao cliente", value: "levar" }
          ]}
        />
        {entregaTipo === "levar" ? (
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-bold">Endereço / referência para entrega</span>
            <textarea className="input min-h-24 resize-y" name="endereco_entrega" placeholder="Ex.: entregar na casa do cliente, endereço ou referência" />
          </label>
        ) : null}
      </Step>

      <Step title="4. Serviços e lavadores" description="O serviço puxa o valor cadastrado. Se houver mais de um lavador, a comissão é dividida igualmente.">
        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-bold">Serviço cadastrado</span>
          <select className="input" name="servico_id" value={servicoId} onChange={(event) => handleServicoPrincipal(event.target.value)} required>
            <option value="">Selecione</option>
            {servicosPrincipais.map((servico) => (
              <option key={servico.id} value={servico.id}>{servico.nome} - {formatMoney(servico.preco)}</option>
            ))}
          </select>
          {servicosPrincipais.length === 0 ? <span className="text-xs font-semibold text-red-700">Nenhum serviço principal ativo encontrado. Confira o cadastro de serviços.</span> : null}
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
          {servicosAdicionaisDisponiveis.length === 0 ? (
            <p className="rounded-lg bg-muted p-3 text-sm font-semibold text-muted-foreground">Nenhum adicional cadastrado para este tipo.</p>
          ) : (
            <div className="grid gap-2">
              {servicosAdicionaisDisponiveis.map((servico) => (
                <label key={servico.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-3 text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" name="servico_adicional_ids" value={servico.id} checked={adicionais.includes(servico.id)} onChange={() => toggleAdicional(servico.id)} />
                    {servico.nome}
                  </span>
                  <strong>{formatMoney(servico.preco)}</strong>
                </label>
              ))}
            </div>
          )}
        </div>

        <Textarea label="Descrição extra" name="descricao_extra" />
      </Step>

      <Step title="5. Valores" description="O total é calculado com base no serviço principal e nos adicionais. O pagamento será registrado depois, pela fila.">
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
        <h2 className="text-xl font-black">6. Confirmar entrada</h2>
        <p className="text-sm leading-6 text-muted-foreground">
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
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function SegmentedChoice({
  label,
  name,
  value,
  onChange,
  options
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="grid gap-2 md:col-span-2">
      <span className="text-sm font-bold">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex min-h-12 cursor-pointer items-center justify-center rounded-lg border px-3 text-center text-sm font-black ${
              value === option.value ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-border bg-white"
            }`}
          >
            <input className="sr-only" type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false
}: {
  label: string;
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold">{label}</span>
      <input className="input" name={name} value={value ?? ""} onChange={(event) => onChange?.(event.target.value)} placeholder={placeholder} required={required} />
    </label>
  );
}

function Textarea({
  label,
  name,
  value,
  onChange
}: {
  label: string;
  name: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 md:col-span-2">
      <span className="text-sm font-bold">{label}</span>
      <textarea className="input min-h-24 resize-y" name={name} value={value ?? ""} onChange={(event) => onChange?.(event.target.value)} />
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

function isPrincipal(servico: Servico) {
  return !isAdicional(servico) && normalizeKey(servico.categoria ?? "principal") !== "adicional";
}

function isAdicional(servico: Servico) {
  const categoria = normalizeKey(servico.categoria);
  const tipo = normalizeKey(servico.tipo);
  return Boolean(servico.adicional) || categoria === "adicional" || tipo === "adicional" || categoria === "servico_adicional";
}

function serviceMatchesType(servico: Servico, tipo: string) {
  const aplicacao = normalizeTipo(servico.aplicacao ?? "todos");
  const tipoAtual = normalizeTipo(tipo);
  if (!aplicacao || aplicacao === "todos" || aplicacao === "all") return true;
  if (!tipoAtual) return true;
  return aplicacao === tipoAtual;
}

function normalizeTipo(value: unknown) {
  const key = normalizeKey(value);
  const aliases: Record<string, string> = {
    carro_pequeno: "carro",
    carro_grande: "carro",
    automovel: "carro",
    veículo: "carro",
    veiculo: "carro",
    veiculo_item: "carro",
    sofa: "sofa",
    sofá: "sofa",
    caminhao: "caminhao",
    caminhão: "caminhao",
    todos: "todos"
  };
  return aliases[key] ?? key;
}

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isCarLikeTipo(value: unknown) {
  return carLikeTypes.includes(normalizeTipo(value));
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
