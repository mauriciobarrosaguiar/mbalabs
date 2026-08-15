"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Permissions = {
  executarOs: boolean;
  editarParametros: boolean;
  editarSeguranca: boolean;
  registrarSarpas: boolean;
  anexarEvidencias: boolean;
  finalizarOperacao: boolean;
  verRelatorios: boolean;
};

type Pilot = {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  observacoes: string;
  usuarioId?: string;
  permissoes: Permissions;
};

type Order = {
  entityId: string;
  data: {
    numero?: string;
    clienteNome?: string;
    fazendaNome?: string;
    talhaoNome?: string;
    status?: string;
    pilotoResponsavelId?: string;
    pilotoResponsavelNome?: string;
  };
};

type PilotForm = {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  observacoes: string;
  senhaAcesso: string;
  confirmarSenha: string;
};

const empty: PilotForm = {
  nome: "",
  cpf: "",
  telefone: "",
  email: "",
  observacoes: "",
  senhaAcesso: "",
  confirmarSenha: "",
};

const permissionLabels: Array<[keyof Permissions, string, string]> = [
  ["executarOs", "Executar OS", "Assumir e executar operações atribuídas."],
  ["editarParametros", "Editar parâmetros", "Alterar dados técnicos planejados da missão."],
  ["editarSeguranca", "Registrar segurança", "Preencher clima, risco e condição de campo."],
  ["registrarSarpas", "Registrar SARPAS", "Informar a conferência/autorização SARPAS."],
  ["anexarEvidencias", "Enviar evidências", "Anexar mapa e evidências da operação."],
  ["finalizarOperacao", "Finalizar operação", "Concluir a execução após todas as validações."],
  ["verRelatorios", "Ver relatórios", "Consultar relatórios e histórico da empresa."],
];

function strongPassword() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const values = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(values, (value) => characters[value % characters.length]).join("");
}

export function DronePilotsManager() {
  const [items, setItems] = useState<Pilot[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [form, setForm] = useState<PilotForm>(empty);
  const [pilotId, setPilotId] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserName, setCurrentUserName] = useState("Gestor");
  const [orderId, setOrderId] = useState("");
  const [pilotChoice, setPilotChoice] = useState("self");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [expanded, setExpanded] = useState("");
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [pilotResponse, orderResponse] = await Promise.all([
        fetch("/api/dronegestor/pilotos", { cache: "no-store" }),
        fetch("/api/dronegestor/cadastros?type=os", { cache: "no-store" }),
      ]);
      const pilotPayload = await pilotResponse.json().catch(() => null);
      const orderPayload = await orderResponse.json().catch(() => null);
      if (!pilotResponse.ok) throw new Error(pilotPayload?.error || "Não foi possível carregar os pilotos.");
      if (!orderResponse.ok) throw new Error(orderPayload?.error || "Não foi possível carregar as ordens de serviço.");

      const nextPilots = (pilotPayload.items || []) as Pilot[];
      const nextOrders = ((orderPayload.items || []) as Order[]).filter((item) =>
        ["aberta", "preparacao", "em_preparacao"].includes(item.data.status || "aberta"),
      );
      setItems(nextPilots);
      setOrders(nextOrders);
      setCanManage(Boolean(pilotPayload.canManage));
      setCurrentUserId(String(pilotPayload.currentUserId || ""));
      setCurrentUserName(String(pilotPayload.currentUserName || "Gestor"));
      setOrderId((current) =>
        current && nextOrders.some((item) => item.entityId === current) ? current : nextOrders[0]?.entityId || "",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar os pilotos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const linkedPilots = useMemo(() => items.filter((item) => Boolean(item.usuarioId)), [items]);
  const selectedOrder = useMemo(() => orders.find((item) => item.entityId === orderId) || null, [orders, orderId]);
  const selectedPilot = useMemo(
    () => (pilotChoice === "self" ? null : linkedPilots.find((item) => item.id === pilotChoice) || null),
    [pilotChoice, linkedPilots],
  );

  function openNewPilot() {
    setForm(empty);
    setPilotId("");
    setShowPassword(false);
    setMessage("");
    setOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function openPilotAccess(pilot: Pilot) {
    setForm({
      nome: pilot.nome,
      cpf: pilot.cpf,
      telefone: pilot.telefone,
      email: pilot.email,
      observacoes: pilot.observacoes,
      senhaAcesso: "",
      confirmarSenha: "",
    });
    setPilotId(pilot.id);
    setShowPassword(false);
    setMessage("");
    setOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function generatePassword() {
    const password = strongPassword();
    setForm((current) => ({ ...current, senhaAcesso: password, confirmarSenha: password }));
    setShowPassword(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canManage || saving) return;
    if (form.senhaAcesso.length < 8) {
      setMessage("A senha inicial precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (form.senhaAcesso !== form.confirmarSenha) {
      setMessage("As duas senhas estão diferentes. Digite a mesma senha nos dois campos.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/dronegestor/pilotos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pilotId: pilotId || undefined,
          nome: form.nome,
          cpf: form.cpf,
          telefone: form.telefone,
          email: form.email,
          observacoes: form.observacoes,
          senhaAcesso: form.senhaAcesso,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível cadastrar o piloto.");

      setForm(empty);
      setPilotId("");
      setOpen(false);
      setExpanded(payload.item?.id || "");
      setMessage(
        payload.createdAccount
          ? "Piloto cadastrado e acesso liberado. Ele já pode entrar no DroneGestor com o e-mail e a senha informados."
          : "Piloto vinculado ao acesso que já existia nesta empresa. A senha anterior não foi alterada.",
      );
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar o piloto.");
    } finally {
      setSaving(false);
    }
  }

  async function savePermissions(pilot: Pilot, next: Permissions) {
    if (!canManage || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/dronegestor/pilotos", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: pilot.id, permissoes: next }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível salvar as autorizações.");
      setItems((current) => current.map((item) => (item.id === pilot.id ? payload.item : item)));
      setMessage(`Autorizações de ${pilot.nome} salvas.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar as autorizações.");
    } finally {
      setSaving(false);
    }
  }

  async function assignPilot() {
    if (!canManage || saving || !selectedOrder || !currentUserId) return;
    const assignedPilotId = pilotChoice === "self" ? currentUserId : String(selectedPilot?.usuarioId || "");
    const pilotName = pilotChoice === "self" ? currentUserName : String(selectedPilot?.nome || "");
    if (!assignedPilotId || !pilotName) {
      setMessage("Escolha um piloto com acesso ativo ao DroneGestor.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/dronegestor/cadastros", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "os",
          entityId: selectedOrder.entityId,
          data: { pilotoResponsavelId: assignedPilotId, pilotoResponsavelNome: pilotName },
        }),
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível vincular o piloto.");
      setMessage(`${selectedOrder.data.numero || "OS"} vinculada a ${pilotName}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível vincular o piloto.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!canManage || !window.confirm("Inativar este piloto? O acesso dele ao DroneGestor será bloqueado e o histórico será preservado.")) {
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/dronegestor/pilotos", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Não foi possível inativar o piloto.");
      setMessage("Piloto inativado. O acesso ao DroneGestor foi bloqueado e o histórico foi preservado.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível inativar o piloto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f8f1] px-3 pb-28 pt-4 text-[#143d31] sm:px-6 sm:py-8">
      <div className="mx-auto grid w-full max-w-3xl gap-4">
        <header className="flex items-center gap-3">
          <Link
            href="/apps/dronegestor/equipe"
            aria-label="Voltar"
            className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#d9e5dc] bg-white text-[#315d4d]"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[.16em] text-[#087a55]">Equipe</p>
            <h1 className="text-2xl font-black">Pilotos e acessos</h1>
            <p className="mt-1 text-sm text-[#718078]">Cadastre o piloto aqui, sem sair do DroneGestor.</p>
          </div>
        </header>

        {message && <p className="rounded-2xl border border-[#cfe0d5] bg-white px-4 py-3 text-sm font-bold leading-5">{message}</p>}

        <section className="rounded-[26px] border border-[#dce7df] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f4eb] text-[#087a55]">
                <UsersRound size={22} />
              </span>
              <div>
                <strong className="block text-lg">
                  {items.length} {items.length === 1 ? "piloto ativo" : "pilotos ativos"}
                </strong>
                <span className="text-xs text-[#718078]">Cada piloto usa seu próprio acesso.</span>
              </div>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={openNewPilot}
                className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-[#087a55] px-4 text-sm font-black text-white"
              >
                <Plus size={17} />
                Cadastrar piloto
              </button>
            )}
          </div>

          {open && canManage && (
            <form ref={formRef} onSubmit={submit} className="mt-4 grid scroll-mt-3 gap-3 border-t border-[#e4ece7] pt-4">
              <div className="rounded-2xl bg-[#eef8f1] p-3 text-sm leading-5 text-[#315d4d]">
                <strong className="block">O acesso será criado agora.</strong>
                O piloto entrará diretamente no DroneGestor com o e-mail e a senha abaixo. Não é necessário cadastrá-lo no painel da MBA Labs.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome do piloto *" value={form.nome} set={(value) => setForm({ ...form, nome: value })} required />
                <Field
                  label="E-mail de acesso *"
                  value={form.email}
                  set={(value) => setForm({ ...form, email: value })}
                  type="email"
                  required
                />
                <Field label="CPF" value={form.cpf} set={(value) => setForm({ ...form, cpf: value })} />
                <Field label="Telefone" value={form.telefone} set={(value) => setForm({ ...form, telefone: value })} type="tel" />
              </div>

              <div className="grid gap-3 rounded-2xl border border-[#dce7df] p-3 sm:grid-cols-2">
                <PasswordField
                  label="Senha inicial *"
                  value={form.senhaAcesso}
                  set={(value) => setForm({ ...form, senhaAcesso: value })}
                  visible={showPassword}
                />
                <PasswordField
                  label="Repita a senha *"
                  value={form.confirmarSenha}
                  set={(value) => setForm({ ...form, confirmarSenha: value })}
                  visible={showPassword}
                />
                <button
                  type="button"
                  onClick={generatePassword}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#bad3c3] px-3 text-sm font-black text-[#176a4c]"
                >
                  <KeyRound size={17} />
                  Gerar senha forte
                </button>
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d8e3db] px-3 text-sm font-black text-[#4e675d]"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  {showPassword ? "Esconder senha" : "Mostrar senha"}
                </button>
                <p className="text-xs leading-5 text-[#61746a] sm:col-span-2">
                  Use uma senha diferente da sua. Entregue-a somente ao piloto. A senha não fica gravada nesta ficha.
                </p>
              </div>

              <label className="grid gap-1.5">
                <span className="text-xs font-black text-[#4e675d]">Observação</span>
                <textarea
                  rows={2}
                  value={form.observacoes}
                  onChange={(event) => setForm({ ...form, observacoes: event.target.value })}
                  className="w-full rounded-xl border border-[#d8e3db] bg-white p-3 text-sm"
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  disabled={saving}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={17} /> : <UserRound size={17} />}
                  {pilotId ? "Criar acesso deste piloto" : "Criar piloto e liberar acesso"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setOpen(false);
                    setPilotId("");
                    setForm(empty);
                  }}
                  className="min-h-12 rounded-xl border border-[#d8e3db] px-4 text-sm font-black text-[#4e675d] disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </section>

        {canManage && (
          <section className="rounded-[26px] border border-[#dce7df] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e8f4eb] text-[#087a55]">
                <ClipboardList size={22} />
              </span>
              <div>
                <strong className="block text-lg">Piloto da operação</strong>
                <p className="mt-1 text-xs leading-5 text-[#718078]">Defina o responsável antes de levar a OS para o campo.</p>
              </div>
            </div>

            {loading ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-[#718078]">
                <Loader2 size={16} className="animate-spin" />
                Carregando OS...
              </div>
            ) : orders.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[#cbded2] px-4 py-5 text-center">
                <CheckCircle2 className="mx-auto text-[#087a55]" size={22} />
                <strong className="mt-2 block text-sm">Nenhuma OS aberta para atribuição.</strong>
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1.5">
                  <span className="text-xs font-black text-[#4e675d]">Ordem de serviço</span>
                  <select
                    value={orderId}
                    onChange={(event) => setOrderId(event.target.value)}
                    className="min-h-12 w-full rounded-xl border border-[#d8e3db] bg-white px-3 text-sm font-bold"
                  >
                    <option value="">Selecione...</option>
                    {orders.map((item) => (
                      <option key={item.entityId} value={item.entityId}>
                        {item.data.numero || "OS"} — {item.data.fazendaNome || item.data.clienteNome || "Operação"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-xs font-black text-[#4e675d]">Piloto responsável</span>
                  <select
                    value={pilotChoice}
                    onChange={(event) => setPilotChoice(event.target.value)}
                    className="min-h-12 w-full rounded-xl border border-[#d8e3db] bg-white px-3 text-sm font-bold"
                  >
                    <option value="self">{currentUserName} — gestor/piloto</option>
                    {linkedPilots.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedOrder?.data.pilotoResponsavelNome && (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    Responsável atual: <strong>{selectedOrder.data.pilotoResponsavelNome}</strong>
                  </p>
                )}
                {items.some((item) => !item.usuarioId) && (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                    Há piloto antigo sem acesso. Toque em <strong>Criar acesso</strong> no cadastro dele para poder atribuir uma OS.
                  </p>
                )}
                <button
                  type="button"
                  disabled={saving || !orderId}
                  onClick={() => void assignPilot()}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#087a55] px-4 text-sm font-black text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={17} /> : <UserRound size={17} />}
                  Vincular piloto à OS
                </button>
              </div>
            )}
          </section>
        )}

        {loading ? (
          <div className="grid min-h-36 place-items-center rounded-2xl bg-white">
            <Loader2 className="animate-spin text-[#087a55]" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[26px] border border-dashed border-[#cbded2] bg-white p-8 text-center">
            <strong>Nenhum piloto cadastrado.</strong>
            <p className="mt-2 text-sm leading-5 text-[#718078]">Toque em “Cadastrar piloto”. O acesso dele será criado aqui mesmo.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {items.map((item) => (
              <PilotCard
                key={item.id}
                item={item}
                canManage={canManage}
                saving={saving}
                expanded={expanded === item.id}
                onToggle={() => setExpanded((current) => (current === item.id ? "" : item.id))}
                onSave={(next) => void savePermissions(item, next)}
                onCreateAccess={() => openPilotAccess(item)}
                onRemove={() => void remove(item.id)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function PilotCard({
  item,
  canManage,
  saving,
  expanded,
  onToggle,
  onSave,
  onCreateAccess,
  onRemove,
}: {
  item: Pilot;
  canManage: boolean;
  saving: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSave: (value: Permissions) => void;
  onCreateAccess: () => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(item.permissoes);
  useEffect(() => setDraft(item.permissoes), [item.permissoes]);

  return (
    <article className="rounded-2xl border border-[#dce7df] bg-white p-4">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <strong className="block truncate">{item.nome}</strong>
          <p className="mt-1 text-xs text-[#718078]">{[item.cpf, item.telefone, item.email].filter(Boolean).join(" • ") || "Sem dados complementares"}</p>
          <span
            className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black ${
              item.usuarioId ? "bg-emerald-100 text-emerald-800" : "bg-amber-50 text-amber-800"
            }`}
          >
            {item.usuarioId ? "Acesso ao DroneGestor ativo" : "Sem acesso ao aplicativo"}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[#dce7df] px-3 text-xs font-black text-[#176a4c]"
        >
          <ShieldCheck size={16} />
          <span className="hidden sm:inline">Autorizações</span>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        {canManage && (
          <button
            type="button"
            disabled={saving}
            onClick={onRemove}
            className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"
            aria-label={`Inativar ${item.nome}`}
          >
            <Trash2 size={17} />
          </button>
        )}
      </div>

      {canManage && !item.usuarioId && (
        <button
          type="button"
          onClick={onCreateAccess}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-100 px-4 text-sm font-black text-amber-950"
        >
          <KeyRound size={17} />
          Criar acesso deste piloto
        </button>
      )}

      {expanded && (
        <div className="mt-4 grid gap-2 border-t border-[#e7eee9] pt-4">
          {permissionLabels.map(([key, label, detail]) => (
            <label key={key} className="flex items-start gap-3 rounded-xl border border-[#e2ebe5] px-3 py-2.5">
              <input
                type="checkbox"
                className="mt-0.5 size-4"
                disabled={!canManage || saving}
                checked={draft[key]}
                onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.checked }))}
              />
              <span className="min-w-0">
                <strong className="block text-sm">{label}</strong>
                <span className="block text-xs leading-4 text-[#718078]">{detail}</span>
              </span>
            </label>
          ))}
          {canManage && (
            <button
              type="button"
              disabled={saving}
              onClick={() => onSave(draft)}
              className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#087a55] px-4 text-sm font-black text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}
              Salvar autorizações
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function Field({
  label,
  value,
  set,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-black text-[#4e675d]">{label}</span>
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => set(event.target.value)}
        className="min-h-12 w-full rounded-xl border border-[#d8e3db] bg-white px-3 text-base sm:text-sm"
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  set,
  visible,
}: {
  label: string;
  value: string;
  set: (value: string) => void;
  visible: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-black text-[#4e675d]">{label}</span>
      <input
        required
        minLength={8}
        autoComplete="new-password"
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => set(event.target.value)}
        className="min-h-12 w-full rounded-xl border border-[#d8e3db] bg-white px-3 text-base sm:text-sm"
      />
    </label>
  );
}
