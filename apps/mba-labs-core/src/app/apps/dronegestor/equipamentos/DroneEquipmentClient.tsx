"use client";

import { Check, Drone, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

type EquipmentData = {
  nome: string;
  marca: string;
  modelo: string;
  numeroSerie: string;
  registroAnac: string;
  tanqueL: number;
  pontaModelo: string;
  faixaPadraoM: number;
  velocidadePadraoKmh: number;
  alturaPadraoM: number;
  volumePadraoLHa: number;
  observacoes: string;
};
type EquipmentItem = { id: string; entityId: string; data: EquipmentData };

const blank: EquipmentData = {
  nome: "",
  marca: "DJI",
  modelo: "",
  numeroSerie: "",
  registroAnac: "",
  tanqueL: 0,
  pontaModelo: "",
  faixaPadraoM: 0,
  velocidadePadraoKmh: 0,
  alturaPadraoM: 0,
  volumePadraoLHa: 0,
  observacoes: ""
};

async function request(options?: RequestInit) {
  const response = await fetch("/api/dronegestor/equipamentos", {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "Falha na operação.");
  return payload;
}

export function DroneEquipmentClient({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [draft, setDraft] = useState<EquipmentData>(blank);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const payload = await request();
      setItems(payload.items ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar os drones.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  function edit(item: EquipmentItem) {
    setEditingId(item.entityId);
    setDraft({ ...blank, ...item.data });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEdit() {
    setEditingId("");
    setDraft(blank);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setMessage("");
    try {
      if (editingId) {
        await request({ method: "PATCH", body: JSON.stringify({ entityId: editingId, data: draft }) });
        setMessage("Equipamento atualizado.");
      } else {
        await request({ method: "POST", body: JSON.stringify({ data: draft }) });
        setMessage("Equipamento cadastrado. Nas próximas operações, basta selecioná-lo.");
      }
      setEditingId("");
      setDraft(blank);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar equipamento.");
    } finally {
      setSaving(false);
    }
  }
  async function remove(item: EquipmentItem) {
    if (!canManage || !window.confirm(`Inativar ${item.data.nome}? Ele deixará de aparecer em novas operações.`)) return;
    setSaving(true);
    try {
      await request({ method: "DELETE", body: JSON.stringify({ entityId: item.entityId }) });
      if (editingId === item.entityId) cancelEdit();
      setMessage("Equipamento inativado.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao inativar equipamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-950">{message}</div>}

      {canManage && (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 text-sm font-black text-emerald-800"><Drone size={18}/> {editingId ? "Editar drone" : "Cadastrar drone"}</span>
              <h2 className="mt-2 text-2xl font-black text-slate-950">Preencha uma vez. Reutilize em todas as aplicações.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Os dados técnicos abaixo serão preenchidos automaticamente quando o piloto selecionar este equipamento.</p>
            </div>
            {editingId && <button type="button" onClick={cancelEdit} className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600" aria-label="Cancelar edição"><X size={18}/></button>}
          </div>

          <form onSubmit={submit} className="mt-5 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Nome fácil *" placeholder="Ex.: T50 - Drone 01" value={draft.nome} onChange={(v) => setDraft({ ...draft, nome: v })}/>
              <TextField label="Marca" placeholder="DJI" value={draft.marca} onChange={(v) => setDraft({ ...draft, marca: v })}/>
              <TextField label="Modelo *" placeholder="Ex.: Agras T50" value={draft.modelo} onChange={(v) => setDraft({ ...draft, modelo: v })}/>
              <TextField label="Nº de série" placeholder="Opcional" value={draft.numeroSerie} onChange={(v) => setDraft({ ...draft, numeroSerie: v })}/>
              <TextField label="Identificação / registro ANAC *" value={draft.registroAnac} onChange={(v) => setDraft({ ...draft, registroAnac: v })}/>
              <NumberField label="Capacidade do tanque *" suffix="L" value={draft.tanqueL} onChange={(v) => setDraft({ ...draft, tanqueL: v })}/>
              <TextField label="Bico / atomizador padrão *" placeholder="Ex.: atomizador original" value={draft.pontaModelo} onChange={(v) => setDraft({ ...draft, pontaModelo: v })}/>
              <NumberField label="Faixa padrão" suffix="m" value={draft.faixaPadraoM} onChange={(v) => setDraft({ ...draft, faixaPadraoM: v })}/>
              <NumberField label="Velocidade padrão" suffix="km/h" value={draft.velocidadePadraoKmh} onChange={(v) => setDraft({ ...draft, velocidadePadraoKmh: v })}/>
              <NumberField label="Altura padrão" suffix="m" value={draft.alturaPadraoM} onChange={(v) => setDraft({ ...draft, alturaPadraoM: v })}/>
              <NumberField label="Volume padrão de calda" suffix="L/ha" value={draft.volumePadraoLHa} onChange={(v) => setDraft({ ...draft, volumePadraoLHa: v })}/>
            </div>
            <label className="grid gap-1.5 text-sm font-bold text-slate-700"><span>Observações</span><textarea className="min-h-24 rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-emerald-500" value={draft.observacoes} onChange={(e) => setDraft({ ...draft, observacoes: e.target.value })} placeholder="Informações internas do equipamento."/></label>
            <button disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 font-black text-white disabled:bg-slate-300" type="submit">{editingId ? <Save size={18}/> : <Plus size={18}/>} {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar equipamento"}</button>
          </form>
        </section>
      )}

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-xl font-black text-slate-950">Equipamentos cadastrados</h2><p className="mt-1 text-sm text-slate-500">O piloto escolhe um deles antes de iniciar a operação.</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">{items.length}</span></div>
        {loading ? <div className="py-10 text-center text-sm font-bold text-slate-500">Carregando...</div> : items.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><Drone className="mx-auto text-slate-400"/><strong className="mt-3 block text-slate-800">Nenhum drone cadastrado</strong><p className="mt-1 text-sm text-slate-500">Cadastre o primeiro equipamento para eliminar digitação repetida no campo.</p></div> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{items.map((item) => <article key={item.entityId} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><Drone size={22}/></span><div className="min-w-0 flex-1"><strong className="block truncate text-base text-slate-950">{item.data.nome}</strong><span className="text-sm text-slate-500">{item.data.marca} {item.data.modelo}</span></div><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700"><Check size={12}/> Ativo</span></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><Data label="Tanque" value={`${item.data.tanqueL || 0} L`}/><Data label="ANAC" value={item.data.registroAnac || "—"}/><Data label="Faixa" value={item.data.faixaPadraoM ? `${item.data.faixaPadraoM} m` : "—"}/><Data label="Velocidade" value={item.data.velocidadePadraoKmh ? `${item.data.velocidadePadraoKmh} km/h` : "—"}/></div>{canManage && <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={saving} onClick={() => edit(item)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 font-black text-slate-700"><Pencil size={15}/> Editar</button><button disabled={saving} onClick={() => void remove(item)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-200 font-black text-red-700"><Trash2 size={15}/> Inativar</button></div>}</article>)}</div>}
      </section>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="grid gap-1.5 text-sm font-bold text-slate-700"><span>{label}</span><input className="min-h-11 rounded-xl border border-slate-200 px-3 outline-none focus:border-emerald-500" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}/></label>;
}
function NumberField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (value: number) => void; suffix: string }) {
  return <label className="grid gap-1.5 text-sm font-bold text-slate-700"><span>{label}</span><div className="flex min-h-11 items-center rounded-xl border border-slate-200 px-3 focus-within:border-emerald-500"><input className="min-w-0 flex-1 outline-none" type="number" min="0" step="any" value={value || ""} onChange={(e) => onChange(Number(e.target.value) || 0)}/><b className="ml-2 text-xs text-slate-500">{suffix}</b></div></label>;
}
function Data({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 px-3 py-2"><span className="block text-slate-400">{label}</span><strong className="mt-0.5 block truncate text-slate-700">{value}</strong></div>;
}
