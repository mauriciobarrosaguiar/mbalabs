"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bike,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Save,
  Settings,
  UserRound,
  Users,
  Wrench
} from "lucide-react";
import type { BikeSection } from "@/components/BikeComandaApp";

type BikeStatus =
  | "aberta"
  | "aguardando_orcamento"
  | "aguardando_aprovacao"
  | "aprovada"
  | "em_manutencao"
  | "aguardando_peca"
  | "finalizada"
  | "entregue"
  | "cancelada";

type PaymentStatus = "aberto" | "parcial" | "pago";
type ItemType = "servico" | "peca" | "mao_obra";

type BikeCliente = {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  documento: string;
  createdAt: string;
};

type BikeBicicleta = {
  id: string;
  clienteId: string;
  marca: string;
  modelo: string;
  cor: string;
  aro: string;
  observacoes: string;
  createdAt: string;
};

type BikeServico = {
  id: string;
  nome: string;
  categoria: ItemType;
  precoBase: number;
  comissaoPercentual: number;
  ativo: boolean;
};

type BikeMecanico = {
  id: string;
  nome: string;
  telefone: string;
  ativo: boolean;
};

type BikeComandaItem = {
  id: string;
  servicoId?: string;
  mecanicoId?: string;
  descricao: string;
  tipo: ItemType;
  quantidade: number;
  valorUnitario: number;
  comissaoPercentual: number;
};

type BikeComanda = {
  id: string;
  numero: number;
  clienteId: string;
  bicicletaId: string;
  mecanicoId: string;
  status: BikeStatus;
  statusPagamento: PaymentStatus;
  formaPagamento: string;
  observacoes: string;
  desconto: number;
  valorTotal: number;
  valorRecebido: number;
  itens: BikeComandaItem[];
  createdAt: string;
  updatedAt: string;
};

type BikePagamento = {
  id: string;
  comandaId: string;
  valor: number;
  formaPagamento: string;
  observacoes: string;
  createdAt: string;
};

type BikeData = {
  clientes: BikeCliente[];
  bicicletas: BikeBicicleta[];
  servicos: BikeServico[];
  mecanicos: BikeMecanico[];
  comandas: BikeComanda[];
  pagamentos: BikePagamento[];
};

type ClientProps = {
  active: BikeSection;
  sections: BikeSection[];
};

const STORAGE_KEY = "mba_labs_bikecomanda_v2";

const statusLabels: Record<BikeStatus, string> = {
  aberta: "Aberta",
  aguardando_orcamento: "Aguardando orçamento",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  em_manutencao: "Em manutenção",
  aguardando_peca: "Aguardando peça",
  finalizada: "Finalizada",
  entregue: "Entregue",
  cancelada: "Cancelada"
};

const statusFlow: BikeStatus[] = [
  "aberta",
  "aguardando_orcamento",
  "aguardando_aprovacao",
  "aprovada",
  "em_manutencao",
  "aguardando_peca",
  "finalizada",
  "entregue",
  "cancelada"
];

const paymentLabels: Record<PaymentStatus, string> = {
  aberto: "Aberto",
  parcial: "Parcial",
  pago: "Pago"
};

const itemTypeLabels: Record<ItemType, string> = {
  servico: "Serviço",
  peca: "Peça",
  mao_obra: "Mão de obra"
};

const wizardSteps = [
  "Cliente",
  "Bicicleta",
  "Serviços/peças",
  "Orçamento",
  "Responsável",
  "Pagamento"
];

const moneyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

function defaultBikeData(): BikeData {
  return {
    clientes: [],
    bicicletas: [],
    servicos: [
      {
        id: createId(),
        nome: "Revisão simples",
        categoria: "servico",
        precoBase: 90,
        comissaoPercentual: 15,
        ativo: true
      },
      {
        id: createId(),
        nome: "Revisão completa",
        categoria: "servico",
        precoBase: 180,
        comissaoPercentual: 20,
        ativo: true
      },
      {
        id: createId(),
        nome: "Regulagem de freio",
        categoria: "servico",
        precoBase: 35,
        comissaoPercentual: 15,
        ativo: true
      },
      {
        id: createId(),
        nome: "Peça avulsa",
        categoria: "peca",
        precoBase: 0,
        comissaoPercentual: 0,
        ativo: true
      }
    ],
    mecanicos: [],
    comandas: [],
    pagamentos: []
  };
}

export function BikeComandaClient({ active, sections }: ClientProps) {
  const router = useRouter();
  const [data, setData] = useState<BikeData>(() => defaultBikeData());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setReady(true);
      return;
    }

    try {
      setData(hydrateData(JSON.parse(raw)));
    } catch {
      setData(defaultBikeData());
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (ready) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [data, ready]);

  const helpers = useMemo(() => createHelpers(data), [data]);

  return (
    <div className="min-h-screen bg-[#f6f9fb] text-[#17212b]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-[#d9e6ee] bg-white px-4 py-5 lg:flex lg:flex-col">
        <Link className="block shrink-0" href="/bikecomanda">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#0f6b99] text-white">
            <Bike className="h-5 w-5" aria-hidden />
          </div>
          <div className="mt-3 text-xl font-black tracking-tight text-[#0f4665]">BikeComanda</div>
          <p className="mt-1 text-sm text-[#5d7180]">Comandas para bicicletarias</p>
        </Link>

        <nav className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {sections.map((item) => (
            <Link
              aria-current={item.slug === active.slug ? "page" : undefined}
              className="flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-bold text-[#263d4f] hover:bg-[#edf6fb] aria-[current=page]:bg-[#dff2fb] aria-[current=page]:text-[#0f4665]"
              href={item.slug === "dashboard" ? "/bikecomanda" : `/bikecomanda/${item.slug}`}
              key={item.slug}
            >
              {iconFor(item.slug)}
              {item.label}
            </Link>
          ))}
        </nav>

        <Link className="mt-4 inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#d9e6ee] bg-white px-3 text-sm font-bold shadow-sm" href="/dashboard">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao MBA Labs
        </Link>
      </aside>

      <header className="sticky top-0 z-10 border-b border-[#d9e6ee] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/bikecomanda">
            <div className="font-black text-[#0f4665]">BikeComanda</div>
            <div className="text-xs text-[#5d7180]">Comandas para bicicletarias</div>
          </Link>
          <Link className="rounded-lg border border-[#d9e6ee] px-3 py-2 text-sm font-bold" href="/dashboard">
            MBA Labs
          </Link>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {sections.map((item) => (
            <Link
              aria-current={item.slug === active.slug ? "page" : undefined}
              className="inline-flex min-h-10 shrink-0 items-center rounded-lg bg-[#edf6fb] px-3 text-sm font-bold text-[#263d4f] aria-[current=page]:bg-[#0f6b99] aria-[current=page]:text-white"
              href={item.slug === "dashboard" ? "/bikecomanda" : `/bikecomanda/${item.slug}`}
              key={`${item.slug}-mobile`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="px-4 py-6 lg:ml-72 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-[#0f6b99]">BikeComanda</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">{active.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5d7180]">{active.description}</p>
            </div>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#0f6b99] px-4 font-bold text-white shadow-sm" href="/bikecomanda/nova-comanda">
              Nova comanda
            </Link>
          </div>

          {renderContent(active.slug, data, setData, helpers, router.push)}
        </div>
      </main>
    </div>
  );
}

function renderContent(
  slug: string,
  data: BikeData,
  setData: Dispatch<SetStateAction<BikeData>>,
  helpers: ReturnType<typeof createHelpers>,
  navigate: (href: string) => void
) {
  if (slug === "dashboard") return <DashboardContent data={data} helpers={helpers} />;
  if (slug === "nova-comanda") return <NovaComandaWizard data={data} setData={setData} helpers={helpers} navigate={navigate} />;
  if (slug === "comandas") return <ComandasContent data={data} setData={setData} helpers={helpers} />;
  if (slug === "clientes") return <ClientesContent data={data} setData={setData} />;
  if (slug === "bicicletas") return <BicicletasContent data={data} setData={setData} helpers={helpers} />;
  if (slug === "servicos") return <ServicosContent data={data} setData={setData} />;
  if (slug === "mecanicos") return <MecanicosContent data={data} setData={setData} />;
  if (slug === "comissoes") return <ComissoesContent data={data} helpers={helpers} />;
  if (slug === "pagamentos") return <PagamentosContent data={data} setData={setData} helpers={helpers} />;
  if (slug === "relatorios") return <RelatoriosContent data={data} helpers={helpers} />;
  return <ConfiguracoesContent />;
}

function DashboardContent({ data, helpers }: { data: BikeData; helpers: ReturnType<typeof createHelpers> }) {
  const metrics = [
    { label: "Comandas abertas", value: data.comandas.filter((item) => item.status !== "entregue" && item.status !== "cancelada").length.toString() },
    { label: "Em manutenção", value: data.comandas.filter((item) => item.status === "em_manutencao").length.toString() },
    { label: "Aguardando aprovação", value: data.comandas.filter((item) => item.status === "aguardando_aprovacao").length.toString() },
    { label: "Finalizadas", value: data.comandas.filter((item) => item.status === "finalizada").length.toString() },
    { label: "A receber", value: currency(data.comandas.reduce((sum, item) => sum + Math.max(item.valorTotal - item.valorRecebido, 0), 0)) }
  ];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <div className="rounded-lg border border-[#d9e6ee] bg-white p-4 shadow-sm" key={metric.label}>
            <p className="text-sm font-semibold text-[#5d7180]">{metric.label}</p>
            <p className="mt-2 text-2xl font-black">{metric.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-[#d9e6ee] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black">Fluxo da oficina</h2>
            <p className="mt-1 text-sm text-[#5d7180]">Status usados no dia a dia da bicicletaria.</p>
          </div>
          <Link className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#0f6b99] px-4 text-sm font-bold text-white" href="/bikecomanda/nova-comanda">
            Abrir comanda
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {statusFlow.slice(0, -1).map((status) => (
            <div className="rounded-lg bg-[#edf6fb] p-4" key={status}>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#0f6b99]">{statusLabels[status]}</p>
              <p className="mt-2 text-2xl font-black">{data.comandas.filter((item) => item.status === status).length}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-[#d9e6ee] bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Últimas comandas</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.08em] text-[#5d7180]">
              <tr>
                <th className="py-3">Número</th>
                <th>Cliente</th>
                <th>Bicicleta</th>
                <th>Status</th>
                <th>Pagamento</th>
                <th className="text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d9e6ee]">
              {data.comandas.slice(-6).reverse().map((comanda) => (
                <tr key={comanda.id}>
                  <td className="py-3 font-bold">#{comanda.numero}</td>
                  <td>{helpers.cliente(comanda.clienteId)?.nome ?? "Cliente removido"}</td>
                  <td>{helpers.bicicletaLabel(comanda.bicicletaId)}</td>
                  <td><StatusBadge status={comanda.status} /></td>
                  <td>{paymentLabels[comanda.statusPagamento]}</td>
                  <td className="text-right font-bold">{currency(comanda.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.comandas.length === 0 ? <EmptyState actionHref="/bikecomanda/nova-comanda" actionLabel="Abrir primeira comanda" text="Abra uma comanda para ver os atendimentos da oficina aqui." /> : null}
        </div>
      </section>
    </>
  );
}

function NovaComandaWizard({
  data,
  setData,
  helpers,
  navigate
}: {
  data: BikeData;
  setData: Dispatch<SetStateAction<BikeData>>;
  helpers: ReturnType<typeof createHelpers>;
  navigate: (href: string) => void;
}) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(() => initialWizardDraft());

  const selectedClientId = draft.clienteMode === "existente" ? draft.clienteId : "";
  const clientBikes = data.bicicletas.filter((bike) => bike.clienteId === selectedClientId);
  const subtotal = draft.itens.reduce((sum, item) => sum + item.quantidade * item.valorUnitario, 0);
  const total = Math.max(subtotal - parseMoney(draft.desconto), 0);

  function nextStep() {
    const message = validateWizardStep(step, draft, total);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, wizardSteps.length - 1));
  }

  function previousStep() {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  }

  function addItem() {
    const service = data.servicos.find((item) => item.id === draft.itemServicoId);
    const descricao = service?.nome ?? draft.itemDescricao.trim();
    const valor = service ? service.precoBase : parseMoney(draft.itemValor);

    if (!descricao) {
      setError("Informe a descrição do serviço ou peça.");
      return;
    }
    if (valor <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }

    setDraft((current) => ({
      ...current,
      itemServicoId: "",
      itemDescricao: "",
      itemValor: "",
      itemQuantidade: "1",
      itemComissao: "",
      itens: [
        ...current.itens,
        {
          id: createId(),
          servicoId: service?.id,
          descricao,
          tipo: service?.categoria ?? current.itemTipo,
          quantidade: Math.max(parseMoney(current.itemQuantidade), 1),
          valorUnitario: valor,
          comissaoPercentual: service ? service.comissaoPercentual : parseMoney(current.itemComissao)
        }
      ]
    }));
    setError("");
  }

  function saveComanda() {
    const message = validateWizardStep(step, draft, total);
    if (message) {
      setError(message);
      return;
    }

    setData((current) => {
      const now = new Date().toISOString();
      const cliente =
        draft.clienteMode === "novo"
          ? {
              id: createId(),
              nome: draft.clienteNome.trim(),
              telefone: draft.clienteTelefone.trim(),
              email: draft.clienteEmail.trim(),
              documento: draft.clienteDocumento.trim(),
              createdAt: now
            }
          : undefined;
      const clienteId = cliente?.id ?? draft.clienteId;
      const bicicleta =
        draft.bicicletaMode === "nova"
          ? {
              id: createId(),
              clienteId,
              marca: draft.bikeMarca.trim(),
              modelo: draft.bikeModelo.trim(),
              cor: draft.bikeCor.trim(),
              aro: draft.bikeAro.trim(),
              observacoes: draft.bikeObservacoes.trim(),
              createdAt: now
            }
          : undefined;
      const bicicletaId = bicicleta?.id ?? draft.bicicletaId;
      const mecanico =
        draft.mecanicoMode === "novo"
          ? {
              id: createId(),
              nome: draft.mecanicoNome.trim(),
              telefone: draft.mecanicoTelefone.trim(),
              ativo: true
            }
          : undefined;
      const mecanicoId = mecanico?.id ?? draft.mecanicoId;
      const valorRecebido = Math.min(parseMoney(draft.valorRecebido), total);
      const comanda: BikeComanda = {
        id: createId(),
        numero: nextCommandNumber(current.comandas),
        clienteId,
        bicicletaId,
        mecanicoId,
        status: "aberta",
        statusPagamento: paymentStatus(total, valorRecebido),
        formaPagamento: draft.formaPagamento,
        observacoes: draft.observacoes.trim(),
        desconto: parseMoney(draft.desconto),
        valorTotal: total,
        valorRecebido,
        itens: draft.itens.map((item) => ({ ...item, mecanicoId })),
        createdAt: now,
        updatedAt: now
      };
      const pagamento =
        valorRecebido > 0
          ? {
              id: createId(),
              comandaId: comanda.id,
              valor: valorRecebido,
              formaPagamento: draft.formaPagamento,
              observacoes: "Pagamento informado na abertura",
              createdAt: now
            }
          : undefined;

      return {
        ...current,
        clientes: cliente ? [...current.clientes, cliente] : current.clientes,
        bicicletas: bicicleta ? [...current.bicicletas, bicicleta] : current.bicicletas,
        mecanicos: mecanico ? [...current.mecanicos, mecanico] : current.mecanicos,
        comandas: [...current.comandas, comanda],
        pagamentos: pagamento ? [...current.pagamentos, pagamento] : current.pagamentos
      };
    });

    navigate("/bikecomanda/comandas");
  }

  return (
    <section className="rounded-lg border border-[#d9e6ee] bg-white p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-6">
        {wizardSteps.map((label, index) => (
          <button
            className={`rounded-lg border px-3 py-3 text-left text-sm font-bold ${index === step ? "border-[#0f6b99] bg-[#dff2fb] text-[#0f4665]" : "border-[#d9e6ee] bg-white text-[#5d7180]"}`}
            key={label}
            onClick={() => setStep(index)}
            type="button"
          >
            <span className="block text-xs uppercase tracking-[0.1em]">Passo {index + 1}</span>
            {label}
          </button>
        ))}
      </div>

      {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}

      <div className="mt-5">
        {step === 0 ? (
          <WizardCliente data={data} draft={draft} setDraft={setDraft} />
        ) : step === 1 ? (
          <WizardBicicleta clientBikes={clientBikes} draft={draft} setDraft={setDraft} />
        ) : step === 2 ? (
          <WizardServicos addItem={addItem} data={data} draft={draft} setDraft={setDraft} />
        ) : step === 3 ? (
          <WizardOrcamento draft={draft} setDraft={setDraft} subtotal={subtotal} total={total} />
        ) : step === 4 ? (
          <WizardMecanico data={data} draft={draft} setDraft={setDraft} />
        ) : (
          <WizardPagamento draft={draft} setDraft={setDraft} total={total} />
        )}
      </div>

      <div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-[#d9e6ee] pt-4">
        <Link className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#d9e6ee] bg-white px-4 text-sm font-bold" href="/bikecomanda">
          Cancelar
        </Link>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#d9e6ee] bg-white px-4 text-sm font-bold disabled:opacity-40" disabled={step === 0} onClick={previousStep} type="button">
            Voltar
          </button>
          {step < wizardSteps.length - 1 ? (
            <button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#0f6b99] px-4 text-sm font-bold text-white" onClick={nextStep} type="button">
              Próximo
            </button>
          ) : (
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#0f6b99] px-4 text-sm font-bold text-white" onClick={saveComanda} type="button">
              <Save className="h-4 w-4" aria-hidden />
              Salvar comanda
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function WizardCliente({
  data,
  draft,
  setDraft
}: {
  data: BikeData;
  draft: ReturnType<typeof initialWizardDraft>;
  setDraft: Dispatch<SetStateAction<ReturnType<typeof initialWizardDraft>>>;
}) {
  return (
    <div className="grid gap-5">
      <ChoiceTabs
        current={draft.clienteMode}
        onChange={(value) => setDraft((current) => ({ ...current, clienteMode: value as "existente" | "novo" }))}
        options={[
          ["novo", "Cadastrar novo"],
          ["existente", "Usar cliente existente"]
        ]}
      />
      {draft.clienteMode === "existente" ? (
        <SelectField
          label="Cliente"
          onChange={(clienteId) => setDraft((current) => ({ ...current, clienteId, bicicletaId: "" }))}
          value={draft.clienteId}
        >
          <option value="">Selecione um cliente</option>
          {data.clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>{cliente.nome} - {cliente.telefone}</option>
          ))}
        </SelectField>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Nome do cliente" onChange={(clienteNome) => setDraft((current) => ({ ...current, clienteNome }))} placeholder="Ex.: João da Silva" value={draft.clienteNome} />
          <TextField label="WhatsApp/telefone" onChange={(clienteTelefone) => setDraft((current) => ({ ...current, clienteTelefone }))} placeholder="(00) 00000-0000" value={draft.clienteTelefone} />
          <TextField label="E-mail" onChange={(clienteEmail) => setDraft((current) => ({ ...current, clienteEmail }))} placeholder="cliente@email.com" value={draft.clienteEmail} />
          <TextField label="CPF/CNPJ" onChange={(clienteDocumento) => setDraft((current) => ({ ...current, clienteDocumento }))} placeholder="Opcional" value={draft.clienteDocumento} />
        </div>
      )}
    </div>
  );
}

function WizardBicicleta({
  clientBikes,
  draft,
  setDraft
}: {
  clientBikes: BikeBicicleta[];
  draft: ReturnType<typeof initialWizardDraft>;
  setDraft: Dispatch<SetStateAction<ReturnType<typeof initialWizardDraft>>>;
}) {
  return (
    <div className="grid gap-5">
      <ChoiceTabs
        current={draft.bicicletaMode}
        onChange={(value) => setDraft((current) => ({ ...current, bicicletaMode: value as "nova" | "existente" }))}
        options={[
          ["nova", "Cadastrar bicicleta"],
          ["existente", "Usar bicicleta existente"]
        ]}
      />
      {draft.bicicletaMode === "existente" ? (
        <SelectField label="Bicicleta" onChange={(bicicletaId) => setDraft((current) => ({ ...current, bicicletaId }))} value={draft.bicicletaId}>
          <option value="">Selecione uma bicicleta</option>
          {clientBikes.map((bike) => (
            <option key={bike.id} value={bike.id}>{bikeLabel(bike)}</option>
          ))}
        </SelectField>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Marca" onChange={(bikeMarca) => setDraft((current) => ({ ...current, bikeMarca }))} placeholder="Ex.: Caloi" value={draft.bikeMarca} />
          <TextField label="Modelo" onChange={(bikeModelo) => setDraft((current) => ({ ...current, bikeModelo }))} placeholder="Ex.: Explorer" value={draft.bikeModelo} />
          <TextField label="Cor" onChange={(bikeCor) => setDraft((current) => ({ ...current, bikeCor }))} placeholder="Ex.: Azul" value={draft.bikeCor} />
          <TextField label="Aro" onChange={(bikeAro) => setDraft((current) => ({ ...current, bikeAro }))} placeholder="Ex.: 29" value={draft.bikeAro} />
          <div className="md:col-span-2">
            <TextAreaField label="Observações da bicicleta" onChange={(bikeObservacoes) => setDraft((current) => ({ ...current, bikeObservacoes }))} placeholder="Número de série, acessórios, problema relatado..." value={draft.bikeObservacoes} />
          </div>
        </div>
      )}
    </div>
  );
}

function WizardServicos({
  addItem,
  data,
  draft,
  setDraft
}: {
  addItem: () => void;
  data: BikeData;
  draft: ReturnType<typeof initialWizardDraft>;
  setDraft: Dispatch<SetStateAction<ReturnType<typeof initialWizardDraft>>>;
}) {
  const selectedService = data.servicos.find((item) => item.id === draft.itemServicoId);
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 rounded-lg border border-[#d9e6ee] bg-[#f8fbfd] p-4 lg:grid-cols-5">
        <SelectField
          label="Serviço cadastrado"
          onChange={(itemServicoId) => {
            const service = data.servicos.find((item) => item.id === itemServicoId);
            setDraft((current) => ({
              ...current,
              itemServicoId,
              itemTipo: service?.categoria ?? current.itemTipo,
              itemValor: service ? String(service.precoBase) : current.itemValor,
              itemComissao: service ? String(service.comissaoPercentual) : current.itemComissao
            }));
          }}
          value={draft.itemServicoId}
        >
          <option value="">Serviço/peça manual</option>
          {data.servicos.filter((item) => item.ativo).map((servico) => (
            <option key={servico.id} value={servico.id}>{servico.nome} - {currency(servico.precoBase)}</option>
          ))}
        </SelectField>
        <SelectField label="Tipo" onChange={(itemTipo) => setDraft((current) => ({ ...current, itemTipo: itemTipo as ItemType }))} value={draft.itemTipo}>
          {Object.entries(itemTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </SelectField>
        <TextField disabled={Boolean(selectedService)} label="Descrição manual" onChange={(itemDescricao) => setDraft((current) => ({ ...current, itemDescricao }))} placeholder="Ex.: Câmara de ar" value={selectedService?.nome ?? draft.itemDescricao} />
        <TextField label="Quantidade" onChange={(itemQuantidade) => setDraft((current) => ({ ...current, itemQuantidade }))} type="number" value={draft.itemQuantidade} />
        <TextField label="Valor unitário" onChange={(itemValor) => setDraft((current) => ({ ...current, itemValor }))} type="number" value={draft.itemValor} />
        <TextField label="Comissão %" onChange={(itemComissao) => setDraft((current) => ({ ...current, itemComissao }))} type="number" value={draft.itemComissao} />
        <div className="flex items-end lg:col-span-4">
          <button className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#0f6b99] px-4 text-sm font-bold text-white" onClick={addItem} type="button">
            Adicionar serviço/peça
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#d9e6ee]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[#edf6fb] text-xs uppercase tracking-[0.08em] text-[#5d7180]">
            <tr>
              <th className="p-3">Item</th>
              <th>Tipo</th>
              <th>Qtd.</th>
              <th>Valor</th>
              <th>Comissão</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d9e6ee] bg-white">
            {draft.itens.map((item) => (
              <tr key={item.id}>
                <td className="p-3 font-semibold">{item.descricao}</td>
                <td>{itemTypeLabels[item.tipo]}</td>
                <td>{item.quantidade}</td>
                <td>{currency(item.quantidade * item.valorUnitario)}</td>
                <td>{item.comissaoPercentual}%</td>
                <td className="text-right">
                  <button className="rounded-lg border border-[#d9e6ee] px-3 py-2 text-xs font-bold" onClick={() => setDraft((current) => ({ ...current, itens: current.itens.filter((draftItem) => draftItem.id !== item.id) }))} type="button">
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {draft.itens.length === 0 ? <p className="p-4 text-sm text-[#5d7180]">Adicione ao menos um serviço, peça ou mão de obra para montar a comanda.</p> : null}
      </div>
    </div>
  );
}

function WizardOrcamento({
  draft,
  setDraft,
  subtotal,
  total
}: {
  draft: ReturnType<typeof initialWizardDraft>;
  setDraft: Dispatch<SetStateAction<ReturnType<typeof initialWizardDraft>>>;
  subtotal: number;
  total: number;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_320px]">
      <div className="grid gap-4">
        <TextField label="Desconto" onChange={(desconto) => setDraft((current) => ({ ...current, desconto }))} type="number" value={draft.desconto} />
        <TextAreaField label="Observações para a comanda" onChange={(observacoes) => setDraft((current) => ({ ...current, observacoes }))} placeholder="Problema relatado, prazo combinado, autorização do cliente..." value={draft.observacoes} />
      </div>
      <div className="rounded-lg bg-[#edf6fb] p-4">
        <p className="text-sm font-semibold text-[#5d7180]">Resumo do orçamento</p>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
          <div className="flex justify-between"><span>Desconto</span><strong>{currency(parseMoney(draft.desconto))}</strong></div>
          <div className="flex justify-between border-t border-[#c9dce8] pt-3 text-lg"><span>Total</span><strong>{currency(total)}</strong></div>
        </div>
      </div>
    </div>
  );
}

function WizardMecanico({
  data,
  draft,
  setDraft
}: {
  data: BikeData;
  draft: ReturnType<typeof initialWizardDraft>;
  setDraft: Dispatch<SetStateAction<ReturnType<typeof initialWizardDraft>>>;
}) {
  return (
    <div className="grid gap-5">
      <ChoiceTabs
        current={draft.mecanicoMode}
        onChange={(value) => setDraft((current) => ({ ...current, mecanicoMode: value as "existente" | "novo" }))}
        options={[
          ["existente", "Usar mecânico cadastrado"],
          ["novo", "Cadastrar responsável"]
        ]}
      />
      {draft.mecanicoMode === "existente" ? (
        <SelectField label="Responsável/mecânico" onChange={(mecanicoId) => setDraft((current) => ({ ...current, mecanicoId }))} value={draft.mecanicoId}>
          <option value="">Selecione o responsável</option>
          {data.mecanicos.filter((mecanico) => mecanico.ativo).map((mecanico) => (
            <option key={mecanico.id} value={mecanico.id}>{mecanico.nome}</option>
          ))}
        </SelectField>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Nome do responsável" onChange={(mecanicoNome) => setDraft((current) => ({ ...current, mecanicoNome }))} placeholder="Ex.: Leonardo" value={draft.mecanicoNome} />
          <TextField label="Telefone" onChange={(mecanicoTelefone) => setDraft((current) => ({ ...current, mecanicoTelefone }))} placeholder="Opcional" value={draft.mecanicoTelefone} />
        </div>
      )}
    </div>
  );
}

function WizardPagamento({
  draft,
  setDraft,
  total
}: {
  draft: ReturnType<typeof initialWizardDraft>;
  setDraft: Dispatch<SetStateAction<ReturnType<typeof initialWizardDraft>>>;
  total: number;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_320px]">
      <div className="grid gap-4">
        <SelectField label="Forma de pagamento" onChange={(formaPagamento) => setDraft((current) => ({ ...current, formaPagamento }))} value={draft.formaPagamento}>
          <option value="">Pagamento depois</option>
          <option value="Pix">Pix</option>
          <option value="Cartão de débito">Cartão de débito</option>
          <option value="Cartão de crédito">Cartão de crédito</option>
          <option value="Dinheiro">Dinheiro</option>
          <option value="Fiado">Fiado</option>
        </SelectField>
        <TextField label="Valor recebido na abertura" onChange={(valorRecebido) => setDraft((current) => ({ ...current, valorRecebido }))} placeholder="0,00" type="number" value={draft.valorRecebido} />
      </div>
      <div className="rounded-lg bg-[#edf6fb] p-4">
        <p className="text-sm font-semibold text-[#5d7180]">Situação ao salvar</p>
        <p className="mt-3 text-2xl font-black">{paymentLabels[paymentStatus(total, parseMoney(draft.valorRecebido))]}</p>
        <p className="mt-2 text-sm text-[#5d7180]">Total: {currency(total)}</p>
        <p className="text-sm text-[#5d7180]">Recebido: {currency(parseMoney(draft.valorRecebido))}</p>
      </div>
    </div>
  );
}

function ComandasContent({
  data,
  setData,
  helpers
}: {
  data: BikeData;
  setData: Dispatch<SetStateAction<BikeData>>;
  helpers: ReturnType<typeof createHelpers>;
}) {
  function updateStatus(comandaId: string, status: BikeStatus) {
    setData((current) => ({
      ...current,
      comandas: current.comandas.map((comanda) => comanda.id === comandaId ? { ...comanda, status, updatedAt: new Date().toISOString() } : comanda)
    }));
  }

  return (
    <section className="rounded-lg border border-[#d9e6ee] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black">Comandas da oficina</h2>
          <p className="mt-1 text-sm text-[#5d7180]">Cards compactos: clique em uma comanda para ver itens, pagamento e ações.</p>
        </div>
        <Link className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#0f6b99] px-4 text-sm font-bold text-white" href="/bikecomanda/nova-comanda">
          Nova comanda
        </Link>
      </div>
      <div className="mt-4 grid gap-3">
        {data.comandas.length === 0 ? (
          <EmptyState actionHref="/bikecomanda/nova-comanda" actionLabel="Abrir comanda" text="Use o fluxo guiado para registrar o primeiro atendimento da bicicletaria." />
        ) : null}

        {data.comandas.slice().reverse().map((comanda) => {
          const aberto = Math.max(comanda.valorTotal - comanda.valorRecebido, 0);
          const cliente = helpers.cliente(comanda.clienteId)?.nome ?? "Cliente removido";
          const mecanico = helpers.mecanico(comanda.mecanicoId)?.nome ?? "Sem responsável";

          return (
            <details className="group rounded-lg border border-[#d9e6ee] bg-[#fbfdff] shadow-sm" key={comanda.id}>
              <summary className="grid cursor-pointer list-none gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#0f6b99] px-3 py-1 text-xs font-black text-white">#{comanda.numero}</span>
                      <StatusBadge status={comanda.status} />
                      <span className="rounded-full bg-[#edf6fb] px-3 py-1 text-xs font-black text-[#0f4665]">
                        {paymentLabels[comanda.statusPagamento]}
                      </span>
                    </div>
                    <h3 className="mt-3 truncate text-lg font-black" title={cliente}>{cliente}</h3>
                    <p className="truncate text-sm text-[#5d7180]" title={helpers.bicicletaLabel(comanda.bicicletaId)}>
                      {helpers.bicicletaLabel(comanda.bicicletaId)}
                    </p>
                  </div>
                  <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[420px]">
                    <BikeMiniInfo label="Responsável" value={mecanico} />
                    <BikeMiniInfo label="Total" value={currency(comanda.valorTotal)} strong />
                    <BikeMiniInfo label="Em aberto" value={currency(aberto)} />
                  </div>
                </div>
                <span className="text-xs font-black uppercase tracking-[0.1em] text-[#0f6b99] group-open:hidden">Expandir comanda</span>
                <span className="hidden text-xs font-black uppercase tracking-[0.1em] text-[#0f6b99] group-open:inline">Recolher comanda</span>
              </summary>

              <div className="grid gap-5 border-t border-[#d9e6ee] p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <BikeMiniInfo label="Criada em" value={formatDate(comanda.createdAt)} />
                  <BikeMiniInfo label="Recebido" value={currency(comanda.valorRecebido)} />
                  <BikeMiniInfo label="Forma" value={comanda.formaPagamento || "Ainda não informado"} />
                  <BikeMiniInfo label="Observações" value={comanda.observacoes || "-"} />
                </div>

                <div className="rounded-lg border border-[#d9e6ee] bg-white">
                  <div className="border-b border-[#d9e6ee] px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#5d7180]">
                    Serviços, peças e mão de obra
                  </div>
                  <div className="divide-y divide-[#d9e6ee]">
                    {comanda.itens.map((item) => (
                      <div className="grid gap-2 p-3 text-sm md:grid-cols-[1fr_auto_auto_auto]" key={item.id}>
                        <div>
                          <p className="font-bold">{item.descricao}</p>
                          <p className="text-xs text-[#5d7180]">{itemTypeLabels[item.tipo]}</p>
                        </div>
                        <p>{item.quantidade}x</p>
                        <p>{currency(item.valorUnitario)}</p>
                        <p className="font-black">{currency(item.quantidade * item.valorUnitario)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                  <SelectField label="Atualizar status da comanda" onChange={(status) => updateStatus(comanda.id, status as BikeStatus)} value={comanda.status}>
                    {statusFlow.map((status) => (
                      <option key={status} value={status}>{statusLabels[status]}</option>
                    ))}
                  </SelectField>
                  <Link className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#d9e6ee] bg-white px-4 text-sm font-bold" href="/bikecomanda/pagamentos">
                    Registrar pagamento
                  </Link>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function BikeMiniInfo({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg bg-[#edf6fb] px-3 py-2">
      <p className="text-xs font-black uppercase tracking-[0.08em] text-[#5d7180]">{label}</p>
      <p className={`mt-1 truncate ${strong ? "text-base font-black" : "text-sm font-bold"}`} title={value}>
        {value}
      </p>
    </div>
  );
}

function ClientesContent({ data, setData }: { data: BikeData; setData: Dispatch<SetStateAction<BikeData>> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", documento: "" });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.nome.trim() || !form.telefone.trim()) return;
    setData((current) => ({
      ...current,
      clientes: editingId
        ? current.clientes.map((cliente) => cliente.id === editingId ? { ...cliente, ...form, nome: form.nome.trim(), telefone: form.telefone.trim() } : cliente)
        : [...current.clientes, { id: createId(), ...form, nome: form.nome.trim(), telefone: form.telefone.trim(), createdAt: new Date().toISOString() }]
    }));
    setEditingId(null);
    setForm({ nome: "", telefone: "", email: "", documento: "" });
  }

  return (
    <CrudLayout
      form={
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <TextField label="Nome" onChange={(nome) => setForm((current) => ({ ...current, nome }))} value={form.nome} />
          <TextField label="WhatsApp/telefone" onChange={(telefone) => setForm((current) => ({ ...current, telefone }))} value={form.telefone} />
          <TextField label="E-mail" onChange={(email) => setForm((current) => ({ ...current, email }))} value={form.email} />
          <TextField label="CPF/CNPJ" onChange={(documento) => setForm((current) => ({ ...current, documento }))} value={form.documento} />
          <SubmitRow editing={Boolean(editingId)} onCancel={() => { setEditingId(null); setForm({ nome: "", telefone: "", email: "", documento: "" }); }} />
        </form>
      }
      title="Clientes"
    >
      <SimpleTable
        emptyText="Cadastre clientes para abrir comandas com histórico e vínculo de bicicletas."
        headers={["Nome", "Telefone", "E-mail", "Documento", "Ações"]}
        rows={data.clientes.map((cliente) => [
          cliente.nome,
          cliente.telefone,
          cliente.email || "-",
          cliente.documento || "-",
          <button className="rounded-lg border border-[#d9e6ee] px-3 py-2 text-xs font-bold" key="edit" onClick={() => { setEditingId(cliente.id); setForm({ nome: cliente.nome, telefone: cliente.telefone, email: cliente.email, documento: cliente.documento }); }} type="button">Editar</button>
        ])}
      />
    </CrudLayout>
  );
}

function BicicletasContent({
  data,
  setData,
  helpers
}: {
  data: BikeData;
  setData: Dispatch<SetStateAction<BikeData>>;
  helpers: ReturnType<typeof createHelpers>;
}) {
  const emptyForm = { clienteId: "", marca: "", modelo: "", cor: "", aro: "", observacoes: "" };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.clienteId || !form.marca.trim() || !form.modelo.trim()) return;
    setData((current) => ({
      ...current,
      bicicletas: editingId
        ? current.bicicletas.map((bike) => bike.id === editingId ? { ...bike, ...form, marca: form.marca.trim(), modelo: form.modelo.trim() } : bike)
        : [...current.bicicletas, { id: createId(), ...form, marca: form.marca.trim(), modelo: form.modelo.trim(), createdAt: new Date().toISOString() }]
    }));
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <CrudLayout
      form={
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <SelectField label="Cliente" onChange={(clienteId) => setForm((current) => ({ ...current, clienteId }))} value={form.clienteId}>
            <option value="">Selecione</option>
            {data.clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
          </SelectField>
          <TextField label="Marca" onChange={(marca) => setForm((current) => ({ ...current, marca }))} value={form.marca} />
          <TextField label="Modelo" onChange={(modelo) => setForm((current) => ({ ...current, modelo }))} value={form.modelo} />
          <TextField label="Cor" onChange={(cor) => setForm((current) => ({ ...current, cor }))} value={form.cor} />
          <TextField label="Aro" onChange={(aro) => setForm((current) => ({ ...current, aro }))} value={form.aro} />
          <TextField label="Observações" onChange={(observacoes) => setForm((current) => ({ ...current, observacoes }))} value={form.observacoes} />
          <SubmitRow editing={Boolean(editingId)} onCancel={() => { setEditingId(null); setForm(emptyForm); }} />
        </form>
      }
      title="Bicicletas"
    >
      <SimpleTable
        emptyText="Cadastre bicicletas e vincule cada uma ao cliente antes ou durante a abertura da comanda."
        headers={["Bicicleta", "Cliente", "Cor", "Aro", "Ações"]}
        rows={data.bicicletas.map((bike) => [
          bikeLabel(bike),
          helpers.cliente(bike.clienteId)?.nome ?? "Cliente removido",
          bike.cor || "-",
          bike.aro || "-",
          <button className="rounded-lg border border-[#d9e6ee] px-3 py-2 text-xs font-bold" key="edit" onClick={() => { setEditingId(bike.id); setForm({ clienteId: bike.clienteId, marca: bike.marca, modelo: bike.modelo, cor: bike.cor, aro: bike.aro, observacoes: bike.observacoes }); }} type="button">Editar</button>
        ])}
      />
    </CrudLayout>
  );
}

function ServicosContent({ data, setData }: { data: BikeData; setData: Dispatch<SetStateAction<BikeData>> }) {
  const emptyForm = { nome: "", categoria: "servico" as ItemType, precoBase: "", comissaoPercentual: "" };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.nome.trim()) return;
    setData((current) => ({
      ...current,
      servicos: editingId
        ? current.servicos.map((servico) => servico.id === editingId ? { ...servico, nome: form.nome.trim(), categoria: form.categoria, precoBase: parseMoney(form.precoBase), comissaoPercentual: parseMoney(form.comissaoPercentual) } : servico)
        : [...current.servicos, { id: createId(), nome: form.nome.trim(), categoria: form.categoria, precoBase: parseMoney(form.precoBase), comissaoPercentual: parseMoney(form.comissaoPercentual), ativo: true }]
    }));
    setEditingId(null);
    setForm(emptyForm);
  }

  return (
    <CrudLayout
      form={
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <TextField label="Nome do serviço/peça" onChange={(nome) => setForm((current) => ({ ...current, nome }))} value={form.nome} />
          <SelectField label="Tipo" onChange={(categoria) => setForm((current) => ({ ...current, categoria: categoria as ItemType }))} value={form.categoria}>
            {Object.entries(itemTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </SelectField>
          <TextField label="Preço base" onChange={(precoBase) => setForm((current) => ({ ...current, precoBase }))} type="number" value={form.precoBase} />
          <TextField label="Comissão padrão %" onChange={(comissaoPercentual) => setForm((current) => ({ ...current, comissaoPercentual }))} type="number" value={form.comissaoPercentual} />
          <SubmitRow editing={Boolean(editingId)} onCancel={() => { setEditingId(null); setForm(emptyForm); }} />
        </form>
      }
      title="Serviços e peças"
    >
      <SimpleTable
        emptyText="Configure serviços, peças e preços para acelerar a abertura das comandas."
        headers={["Nome", "Tipo", "Preço base", "Comissão", "Ações"]}
        rows={data.servicos.map((servico) => [
          servico.nome,
          itemTypeLabels[servico.categoria],
          currency(servico.precoBase),
          `${servico.comissaoPercentual}%`,
          <button className="rounded-lg border border-[#d9e6ee] px-3 py-2 text-xs font-bold" key="edit" onClick={() => { setEditingId(servico.id); setForm({ nome: servico.nome, categoria: servico.categoria, precoBase: String(servico.precoBase), comissaoPercentual: String(servico.comissaoPercentual) }); }} type="button">Editar</button>
        ])}
      />
    </CrudLayout>
  );
}

function MecanicosContent({ data, setData }: { data: BikeData; setData: Dispatch<SetStateAction<BikeData>> }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", telefone: "", ativo: true });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.nome.trim()) return;
    setData((current) => ({
      ...current,
      mecanicos: editingId
        ? current.mecanicos.map((mecanico) => mecanico.id === editingId ? { ...mecanico, nome: form.nome.trim(), telefone: form.telefone, ativo: form.ativo } : mecanico)
        : [...current.mecanicos, { id: createId(), nome: form.nome.trim(), telefone: form.telefone, ativo: form.ativo }]
    }));
    setEditingId(null);
    setForm({ nome: "", telefone: "", ativo: true });
  }

  return (
    <CrudLayout
      form={
        <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <TextField label="Nome do mecânico/responsável" onChange={(nome) => setForm((current) => ({ ...current, nome }))} value={form.nome} />
          <TextField label="Telefone" onChange={(telefone) => setForm((current) => ({ ...current, telefone }))} value={form.telefone} />
          <label className="flex items-center gap-2 text-sm font-bold">
            <input checked={form.ativo} onChange={(event) => setForm((current) => ({ ...current, ativo: event.target.checked }))} type="checkbox" />
            Ativo para novas comandas
          </label>
          <SubmitRow editing={Boolean(editingId)} onCancel={() => { setEditingId(null); setForm({ nome: "", telefone: "", ativo: true }); }} />
        </form>
      }
      title="Mecânicos e responsáveis"
    >
      <SimpleTable
        emptyText="Cadastre responsáveis para atribuir serviços e calcular comissões."
        headers={["Nome", "Telefone", "Status", "Ações"]}
        rows={data.mecanicos.map((mecanico) => [
          mecanico.nome,
          mecanico.telefone || "-",
          mecanico.ativo ? "Ativo" : "Inativo",
          <button className="rounded-lg border border-[#d9e6ee] px-3 py-2 text-xs font-bold" key="edit" onClick={() => { setEditingId(mecanico.id); setForm({ nome: mecanico.nome, telefone: mecanico.telefone, ativo: mecanico.ativo }); }} type="button">Editar</button>
        ])}
      />
    </CrudLayout>
  );
}

function PagamentosContent({
  data,
  setData,
  helpers
}: {
  data: BikeData;
  setData: Dispatch<SetStateAction<BikeData>>;
  helpers: ReturnType<typeof createHelpers>;
}) {
  const openCommands = data.comandas.filter((comanda) => comanda.statusPagamento !== "pago");
  const [form, setForm] = useState({ comandaId: openCommands[0]?.id ?? "", valor: "", formaPagamento: "Pix", observacoes: "" });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valor = parseMoney(form.valor);
    if (!form.comandaId || valor <= 0) return;
    const now = new Date().toISOString();
    setData((current) => ({
      ...current,
      pagamentos: [...current.pagamentos, { id: createId(), comandaId: form.comandaId, valor, formaPagamento: form.formaPagamento, observacoes: form.observacoes, createdAt: now }],
      comandas: current.comandas.map((comanda) => {
        if (comanda.id !== form.comandaId) return comanda;
        const received = Math.min(comanda.valorRecebido + valor, comanda.valorTotal);
        return {
          ...comanda,
          valorRecebido: received,
          statusPagamento: paymentStatus(comanda.valorTotal, received),
          formaPagamento: form.formaPagamento,
          updatedAt: now
        };
      })
    }));
    setForm({ comandaId: "", valor: "", formaPagamento: "Pix", observacoes: "" });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <section className="rounded-lg border border-[#d9e6ee] bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Registrar pagamento</h2>
        <form className="mt-4 grid gap-4" onSubmit={submit}>
          <SelectField label="Comanda em aberto" onChange={(comandaId) => setForm((current) => ({ ...current, comandaId }))} value={form.comandaId}>
            <option value="">Selecione</option>
            {openCommands.map((comanda) => (
              <option key={comanda.id} value={comanda.id}>
                #{comanda.numero} - {helpers.cliente(comanda.clienteId)?.nome ?? "Cliente"} - falta {currency(Math.max(comanda.valorTotal - comanda.valorRecebido, 0))}
              </option>
            ))}
          </SelectField>
          <TextField label="Valor recebido" onChange={(valor) => setForm((current) => ({ ...current, valor }))} type="number" value={form.valor} />
          <SelectField label="Forma" onChange={(formaPagamento) => setForm((current) => ({ ...current, formaPagamento }))} value={form.formaPagamento}>
            <option>Pix</option>
            <option>Cartão de débito</option>
            <option>Cartão de crédito</option>
            <option>Dinheiro</option>
            <option>Fiado</option>
          </SelectField>
          <TextAreaField label="Observações" onChange={(observacoes) => setForm((current) => ({ ...current, observacoes }))} value={form.observacoes} />
          <button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#0f6b99] px-4 text-sm font-bold text-white" type="submit">Salvar pagamento</button>
        </form>
      </section>
      <section className="rounded-lg border border-[#d9e6ee] bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Histórico de pagamentos</h2>
        <SimpleTable
          emptyText="Registre pagamentos parciais ou totais das comandas."
          headers={["Data", "Comanda", "Cliente", "Forma", "Valor"]}
          rows={data.pagamentos.slice().reverse().map((pagamento) => {
            const comanda = helpers.comanda(pagamento.comandaId);
            return [
              formatDate(pagamento.createdAt),
              comanda ? `#${comanda.numero}` : "-",
              comanda ? helpers.cliente(comanda.clienteId)?.nome ?? "-" : "-",
              pagamento.formaPagamento,
              currency(pagamento.valor)
            ];
          })}
        />
      </section>
    </div>
  );
}

function ComissoesContent({ data, helpers }: { data: BikeData; helpers: ReturnType<typeof createHelpers> }) {
  const rows = data.comandas.flatMap((comanda) =>
    comanda.itens.map((item) => {
      const base = item.quantidade * item.valorUnitario;
      const valorComissao = (base * item.comissaoPercentual) / 100;
      return {
        comanda,
        item,
        valorComissao
      };
    })
  ).filter((row) => row.valorComissao > 0);

  return (
    <section className="rounded-lg border border-[#d9e6ee] bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">Comissões calculadas</h2>
      <SimpleTable
        emptyText="As comissões aparecem quando a comanda possui itens com percentual configurado."
        headers={["Comanda", "Mecânico", "Serviço", "Base", "%", "Comissão"]}
        rows={rows.map((row) => [
          `#${row.comanda.numero}`,
          helpers.mecanico(row.item.mecanicoId ?? row.comanda.mecanicoId)?.nome ?? "Sem responsável",
          row.item.descricao,
          currency(row.item.quantidade * row.item.valorUnitario),
          `${row.item.comissaoPercentual}%`,
          currency(row.valorComissao)
        ])}
      />
    </section>
  );
}

function RelatoriosContent({ data, helpers }: { data: BikeData; helpers: ReturnType<typeof createHelpers> }) {
  const receita = data.comandas.reduce((sum, item) => sum + item.valorTotal, 0);
  const recebido = data.comandas.reduce((sum, item) => sum + item.valorRecebido, 0);
  const comissoes = data.comandas.flatMap((item) => item.itens).reduce((sum, item) => sum + ((item.quantidade * item.valorUnitario * item.comissaoPercentual) / 100), 0);
  const topClients = data.clientes.map((cliente) => ({
    cliente,
    total: data.comandas.filter((comanda) => comanda.clienteId === cliente.id).reduce((sum, item) => sum + item.valorTotal, 0)
  })).filter((item) => item.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Receita em comandas" value={currency(receita)} />
        <Metric label="Recebido" value={currency(recebido)} />
        <Metric label="Em aberto" value={currency(Math.max(receita - recebido, 0))} />
        <Metric label="Comissões" value={currency(comissoes)} />
      </div>
      <section className="rounded-lg border border-[#d9e6ee] bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Clientes com mais movimento</h2>
        <SimpleTable
          emptyText="Os clientes aparecem aqui conforme as comandas são abertas."
          headers={["Cliente", "Telefone", "Total em comandas"]}
          rows={topClients.map(({ cliente, total }) => [cliente.nome, cliente.telefone, currency(total)])}
        />
      </section>
      <section className="rounded-lg border border-[#d9e6ee] bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Status das comandas</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {statusFlow.map((status) => (
            <Metric key={status} label={statusLabels[status]} value={String(data.comandas.filter((comanda) => comanda.status === status).length)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ConfiguracoesContent() {
  return (
    <section className="rounded-lg border border-[#d9e6ee] bg-white p-5 shadow-sm">
      <h2 className="text-xl font-black">Configurações e dados</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5d7180]">
        O BikeComanda está funcionando no MBA Labs com armazenamento local no navegador para uso imediato. A estrutura de entidades já segue o padrão planejado para Supabase e tenant por empresa.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {["bike_clientes", "bike_bicicletas", "bike_servicos", "bike_mecanicos", "bike_comandas", "bike_comanda_itens", "bike_pagamentos", "bike_comissoes"].map((table) => (
          <div className="rounded-lg bg-[#edf6fb] p-4 text-sm font-bold text-[#0f4665]" key={table}>{table}</div>
        ))}
      </div>
    </section>
  );
}

function CrudLayout({ children, form, title }: { children: ReactNode; form: ReactNode; title: string }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <section className="rounded-lg border border-[#d9e6ee] bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">{title}</h2>
        <div className="mt-4">{form}</div>
      </section>
      <section className="rounded-lg border border-[#d9e6ee] bg-white p-5 shadow-sm">
        {children}
      </section>
    </div>
  );
}

function SimpleTable({ emptyText, headers, rows }: { emptyText: string; headers: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-[#edf6fb] text-xs uppercase tracking-[0.08em] text-[#5d7180]">
          <tr>
            {headers.map((header) => <th className="p-3" key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#d9e6ee]">
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => <td className="p-3" key={cellIndex}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="rounded-b-lg border-x border-b border-[#d9e6ee] p-4 text-sm text-[#5d7180]">{emptyText}</p> : null}
    </div>
  );
}

function SubmitRow({ editing, onCancel }: { editing: boolean; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap items-end gap-2 md:col-span-2">
      <button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#0f6b99] px-4 text-sm font-bold text-white" type="submit">
        {editing ? "Salvar edição" : "Cadastrar"}
      </button>
      {editing ? (
        <button className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#d9e6ee] bg-white px-4 text-sm font-bold" onClick={onCancel} type="button">
          Cancelar edição
        </button>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d9e6ee] bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-[#5d7180]">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function EmptyState({ actionHref, actionLabel, text }: { actionHref: string; actionLabel: string; text: string }) {
  return (
    <div className="mt-4 rounded-lg bg-[#edf6fb] p-4 text-sm text-[#0f4665]">
      <p className="font-semibold">{text}</p>
      <Link className="mt-3 inline-flex min-h-10 items-center justify-center rounded-lg bg-[#0f6b99] px-4 font-bold text-white" href={actionHref}>
        {actionLabel}
      </Link>
    </div>
  );
}

function TextField({
  disabled = false,
  label,
  onChange,
  placeholder,
  type = "text",
  value
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <input
        className="min-h-11 rounded-lg border border-[#d9e6ee] bg-white px-3 text-sm font-semibold outline-none focus:border-[#0f6b99] disabled:bg-[#eef3f7]"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        step={type === "number" ? "0.01" : undefined}
        type={type}
        value={value}
      />
    </label>
  );
}

function TextAreaField({ label, onChange, placeholder, value }: { label: string; onChange: (value: string) => void; placeholder?: string; value: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <textarea
        className="min-h-28 rounded-lg border border-[#d9e6ee] bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#0f6b99]"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </label>
  );
}

function SelectField({ children, label, onChange, value }: { children: ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold">
      {label}
      <select className="min-h-11 rounded-lg border border-[#d9e6ee] bg-white px-3 text-sm font-semibold outline-none focus:border-[#0f6b99]" onChange={(event) => onChange(event.target.value)} value={value}>
        {children}
      </select>
    </label>
  );
}

function ChoiceTabs({ current, onChange, options }: { current: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([value, label]) => (
        <button
          className={`min-h-10 rounded-lg border px-4 text-sm font-bold ${current === value ? "border-[#0f6b99] bg-[#dff2fb] text-[#0f4665]" : "border-[#d9e6ee] bg-white text-[#5d7180]"}`}
          key={value}
          onClick={() => onChange(value)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: BikeStatus }) {
  return <span className="inline-flex rounded-full bg-[#edf6fb] px-3 py-1 text-xs font-black text-[#0f4665]">{statusLabels[status]}</span>;
}

function initialWizardDraft() {
  return {
    clienteMode: "novo" as "novo" | "existente",
    clienteId: "",
    clienteNome: "",
    clienteTelefone: "",
    clienteEmail: "",
    clienteDocumento: "",
    bicicletaMode: "nova" as "nova" | "existente",
    bicicletaId: "",
    bikeMarca: "",
    bikeModelo: "",
    bikeCor: "",
    bikeAro: "",
    bikeObservacoes: "",
    itemServicoId: "",
    itemDescricao: "",
    itemTipo: "servico" as ItemType,
    itemQuantidade: "1",
    itemValor: "",
    itemComissao: "",
    itens: [] as BikeComandaItem[],
    desconto: "",
    observacoes: "",
    mecanicoMode: "existente" as "existente" | "novo",
    mecanicoId: "",
    mecanicoNome: "",
    mecanicoTelefone: "",
    valorRecebido: "",
    formaPagamento: ""
  };
}

function validateWizardStep(step: number, draft: ReturnType<typeof initialWizardDraft>, total: number) {
  if (step === 0) {
    if (draft.clienteMode === "existente" && !draft.clienteId) return "Selecione um cliente.";
    if (draft.clienteMode === "novo" && (!draft.clienteNome.trim() || !draft.clienteTelefone.trim())) return "Informe nome e telefone do cliente.";
  }
  if (step === 1) {
    if (draft.bicicletaMode === "existente" && !draft.bicicletaId) return "Selecione uma bicicleta.";
    if (draft.bicicletaMode === "nova" && (!draft.bikeMarca.trim() || !draft.bikeModelo.trim())) return "Informe marca e modelo da bicicleta.";
  }
  if (step === 2 && draft.itens.length === 0) return "Adicione pelo menos um serviço, peça ou mão de obra.";
  if (step === 3 && total <= 0) return "O orçamento precisa ter valor maior que zero.";
  if (step === 4) {
    if (draft.mecanicoMode === "existente" && !draft.mecanicoId) return "Selecione um responsável ou cadastre um novo.";
    if (draft.mecanicoMode === "novo" && !draft.mecanicoNome.trim()) return "Informe o nome do responsável.";
  }
  if (step === 5 && parseMoney(draft.valorRecebido) > total) return "O valor recebido não pode ser maior que o total.";
  return "";
}

function createHelpers(data: BikeData) {
  return {
    cliente: (id?: string) => data.clientes.find((item) => item.id === id),
    bicicleta: (id?: string) => data.bicicletas.find((item) => item.id === id),
    mecanico: (id?: string) => data.mecanicos.find((item) => item.id === id),
    comanda: (id?: string) => data.comandas.find((item) => item.id === id),
    bicicletaLabel: (id?: string) => {
      const bike = data.bicicletas.find((item) => item.id === id);
      return bike ? bikeLabel(bike) : "Bicicleta removida";
    }
  };
}

function hydrateData(raw: Partial<BikeData>): BikeData {
  const fallback = defaultBikeData();
  return {
    clientes: Array.isArray(raw.clientes) ? raw.clientes : [],
    bicicletas: Array.isArray(raw.bicicletas) ? raw.bicicletas : [],
    servicos: Array.isArray(raw.servicos) && raw.servicos.length > 0 ? raw.servicos : fallback.servicos,
    mecanicos: Array.isArray(raw.mecanicos) ? raw.mecanicos : [],
    comandas: Array.isArray(raw.comandas) ? raw.comandas : [],
    pagamentos: Array.isArray(raw.pagamentos) ? raw.pagamentos : []
  };
}

function iconFor(slug: string) {
  const className = "h-4 w-4 text-[#0f6b99]";
  if (slug === "dashboard") return <LayoutDashboard className={className} aria-hidden />;
  if (slug === "nova-comanda" || slug === "comandas") return <ClipboardList className={className} aria-hidden />;
  if (slug === "clientes") return <Users className={className} aria-hidden />;
  if (slug === "bicicletas") return <Bike className={className} aria-hidden />;
  if (slug === "servicos") return <Wrench className={className} aria-hidden />;
  if (slug === "mecanicos") return <UserRound className={className} aria-hidden />;
  if (slug === "pagamentos") return <CreditCard className={className} aria-hidden />;
  if (slug === "relatorios") return <FileText className={className} aria-hidden />;
  if (slug === "configuracoes") return <Settings className={className} aria-hidden />;
  return <ClipboardList className={className} aria-hidden />;
}

function bikeLabel(bike: BikeBicicleta) {
  return [bike.marca, bike.modelo, bike.cor ? `(${bike.cor})` : ""].filter(Boolean).join(" ");
}

function nextCommandNumber(comandas: BikeComanda[]) {
  return comandas.reduce((highest, comanda) => Math.max(highest, comanda.numero), 0) + 1;
}

function paymentStatus(total: number, received: number): PaymentStatus {
  if (received >= total && total > 0) return "pago";
  if (received > 0) return "parcial";
  return "aberto";
}

function parseMoney(value: string | number | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currency(value: number) {
  return moneyFormatter.format(value || 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}
