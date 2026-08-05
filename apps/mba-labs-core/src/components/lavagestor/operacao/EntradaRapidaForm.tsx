"use client";

import { useMemo, useState } from "react";
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

type Convenio = {
  id: string;
  nome: string;
  percentual_desconto?: number | null;
  nao_paga?: boolean;
};

export function EntradaRapidaForm({
  clientes,
  veiculos,
  servicos,
  servicosAdicionais = [],
  convenios = [],
  ok,
  error
}: {
  clientes: Cliente[];
  veiculos: Veiculo[];
  servicos: Servico[];
  servicosAdicionais?: Servico[];
  convenios?: Convenio[];
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
  const [adicionalIds, setAdicionalIds] = useState<string[]>([]);
  const [convenioId, setConvenioId] = useState("");
  const [descontoTipo, setDescontoTipo] = useState<"valor" | "percentual">("valor");
  const [descontoValor, setDescontoValor] = useState("");
  const [descontoPercentual, setDescontoPercentual] = useState("");

  const resumo = useMemo(() => {
    const principal = servicos.find((servico) => servico.id === servicoId);
    const adicionais = servicosAdicionais.filter((servico) => adicionalIds.includes(servico.id));
    const totalBruto = money(principal?.preco) + adicionais.reduce((total, servico) => total + money(servico.preco), 0);
    const convenio = convenios.find((item) => item.id === convenioId);
    const descontoConvenio = convenio?.nao_paga ? totalBruto : roundMoney(totalBruto * Math.min(Math.max(money(convenio?.percentual_desconto), 0), 100) / 100);
    const descontoManual = descontoTipo === "percentual"
      ? roundMoney(totalBruto * Math.min(Math.max(money(descontoPercentual), 0), 100) / 100)
      : money(descontoValor);
    const descontoTotal = roundMoney(Math.min(totalBruto, Math.max(0, descontoConvenio + descontoManual)));
    return { totalBruto, descontoTotal, valorFinal: roundMoney(Math.max(totalBruto - descontoTotal, 0)) };
  }, [adicionalIds, convenioId, convenios, descontoPercentual, descontoTipo, descontoValor, servicoId, servicos, servicosAdicionais]);

  function toggleAdicional(id: string) {
    setAdicionalIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

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
    <form action={createLavagemMelhorada} encType="multipart/form-data" className="grid w-full max-w-full min-w-0 gap-3 overflow-hidden">
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
      <input type="hidden" name="descricao_extra" value="Entrada rapida" />

      <section className="grid w-full max-w-full min-w-0 gap-3 overflow-hidden rounded-2xl border border-border bg-white p-3 shadow-sm sm:rounded-3xl sm:p-4">
        <h1 className="break-words text-center text-2xl font-black leading-tight sm:text-3xl">Entrada de veiculo</h1>

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

        <label className="grid min-w-0 gap-2">
          <span className="break-words text-center text-base font-black leading-tight sm:text-lg">Digite a placa</span>
          <input
            className="input min-h-12 w-full min-w-0 text-center text-xl font-black uppercase tracking-[0.08em] sm:min-h-14 sm:text-2xl sm:tracking-[0.12em]"
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

        <label className="grid min-w-0 gap-2">
          <span className="break-words text-center text-base font-black leading-tight sm:text-lg">Tipo de servico</span>
          <select className="input min-h-12 w-full min-w-0 text-center text-sm font-bold sm:min-h-14 sm:text-base" name="servico_id" required value={servicoId} onChange={(event) => setServicoId(event.target.value)}>
            {servicos.map((servico) => (
              <option key={servico.id} value={servico.id}>{servico.nome}</option>
            ))}
          </select>
        </label>

        {servicosAdicionais.length > 0 ? (
          <div className="grid w-full min-w-0 gap-2 overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50 p-2 sm:p-3">
            <p className="break-words text-center text-lg font-black leading-tight text-slate-950 sm:text-xl">Produtos adicionais</p>
            <div className="grid min-w-0 gap-2">
              {servicosAdicionais.map((servico) => (
                <label className="grid min-h-12 min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm font-black text-slate-950 shadow-sm" key={servico.id}>
                  <input className="row-span-2 h-5 w-5 shrink-0 self-center" type="checkbox" name="servico_adicional_ids" value={servico.id} checked={adicionalIds.includes(servico.id)} onChange={() => toggleAdicional(servico.id)} />
                  <span className="min-w-0 truncate leading-5">{servico.nome}</span>
                  <span className="min-w-0 truncate text-sm leading-5 text-emerald-900">{formatCurrency(servico.preco)}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {convenios.length > 0 ? (
          <label className="grid min-w-0 gap-2">
            <span className="break-words text-center text-base font-black leading-tight sm:text-lg">Convênio</span>
            <select className="input min-h-12 w-full min-w-0 text-center text-sm font-bold sm:min-h-14 sm:text-base" name="convenio_id" value={convenioId} onChange={(event) => setConvenioId(event.target.value)}>
              <option value="">Sem convênio</option>
              {convenios.map((convenio) => (
                <option key={convenio.id} value={convenio.id}>{convenio.nome}</option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid w-full min-w-0 gap-2 overflow-hidden rounded-2xl border border-amber-100 bg-amber-50 p-2 sm:p-3">
          <p className="break-words text-center text-lg font-black leading-tight text-slate-950 sm:text-xl">Desconto manual</p>
          <div className="grid min-w-0 grid-cols-2 gap-2">
            <button className={`min-h-11 min-w-0 rounded-xl border px-3 text-sm font-black ${descontoTipo === "valor" ? "border-emerald-300 bg-white text-emerald-900" : "border-slate-200 bg-white text-slate-800"}`} type="button" onClick={() => setDescontoTipo("valor")}>R$</button>
            <button className={`min-h-11 min-w-0 rounded-xl border px-3 text-sm font-black ${descontoTipo === "percentual" ? "border-emerald-300 bg-white text-emerald-900" : "border-slate-200 bg-white text-slate-800"}`} type="button" onClick={() => setDescontoTipo("percentual")}>%</button>
          </div>
          <input type="hidden" name="desconto_tipo" value={descontoTipo} />
          <input type="hidden" name="desconto_percentual" value={descontoTipo === "percentual" ? descontoPercentual : "0"} />
          <input
            className="input min-h-12 w-full min-w-0 text-center text-sm font-bold sm:min-h-14 sm:text-base"
            name="valor_desconto"
            inputMode="decimal"
            placeholder={descontoTipo === "percentual" ? "Desconto em %" : "Desconto em R$"}
            value={descontoTipo === "percentual" ? descontoPercentual : descontoValor}
            onChange={(event) => descontoTipo === "percentual" ? setDescontoPercentual(event.target.value) : setDescontoValor(event.target.value)}
          />
        </div>

        <div className="grid w-full min-w-0 grid-cols-1 gap-2 rounded-2xl border border-emerald-100 bg-white p-2 text-center shadow-sm sm:grid-cols-3 sm:p-3">
          <Info label="Total" value={formatCurrency(resumo.totalBruto)} />
          <Info label="Desconto" value={formatCurrency(resumo.descontoTotal)} />
          <Info label="Final" value={formatCurrency(resumo.valorFinal)} />
        </div>

        <label className="grid min-w-0 gap-2">
          <span className="break-words text-center text-base font-black leading-tight sm:text-lg">Foto da placa</span>
          <input className="input min-h-12 w-full min-w-0 bg-white text-sm font-bold sm:min-h-14" name="foto_placa" type="file" accept="image/*" capture="environment" />
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
    <label className="grid min-w-0 gap-2">
      <span className="break-words text-center text-base font-black leading-tight sm:text-lg">{label}</span>
      <input className="input min-h-12 w-full min-w-0 text-center text-sm font-bold sm:min-h-14 sm:text-base" name={name} list={list} placeholder={placeholder} required={required} inputMode={inputMode} value={value} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <span className="min-w-0 rounded-xl bg-muted px-2 py-2"><span className="block text-[10px] font-black uppercase tracking-[0.08em] text-muted-foreground">{label}</span><strong className="block truncate text-sm" title={value}>{value}</strong></span>;
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));
}

function money(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value ?? "0").replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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
