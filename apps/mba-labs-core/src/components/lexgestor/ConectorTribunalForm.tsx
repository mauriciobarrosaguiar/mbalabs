"use client";

import { useMemo, useState } from "react";
import { salvarConectorTribunalLexGestor } from "@/app/lexgestor/actions";

type AdvogadoOption = { id: string; nome: string; email: string };
type ConectorOption = {
  id?: string;
  sistema?: string;
  tribunal?: string | null;
  uf?: string | null;
  nome?: string | null;
  urlBase?: string | null;
  advogadoId?: string | null;
  modo?: string | null;
  status?: string | null;
  observacoes?: string | null;
};

type CatalogItem = {
  sistema: string;
  sistemaLabel: string;
  tribunal: string;
  tribunalLabel: string;
  uf: string;
  nome: string;
  urlBase: string;
};

const CATALOG: CatalogItem[] = [
  { sistema: "eproc", sistemaLabel: "eproc", tribunal: "TJTO", tribunalLabel: "TJTO - Tribunal de Justiça do Tocantins", uf: "TO", nome: "eproc TJTO - 1º Grau", urlBase: "" },
  { sistema: "eproc", sistemaLabel: "eproc", tribunal: "TJTO", tribunalLabel: "TJTO - Tribunal de Justiça do Tocantins", uf: "TO", nome: "eproc TJTO - 2º Grau", urlBase: "" },
  { sistema: "eproc", sistemaLabel: "eproc", tribunal: "TRF1", tribunalLabel: "TRF1 - Tribunal Regional Federal da 1ª Região", uf: "TO", nome: "eproc TRF1 - TO", urlBase: "" },
  { sistema: "pje", sistemaLabel: "PJe", tribunal: "TRT10", tribunalLabel: "TRT10 - Tribunal Regional do Trabalho da 10ª Região", uf: "TO", nome: "PJe TRT10 - TO/DF", urlBase: "" },
  { sistema: "pje", sistemaLabel: "PJe", tribunal: "TRF1", tribunalLabel: "TRF1 - Tribunal Regional Federal da 1ª Região", uf: "TO", nome: "PJe TRF1 - TO", urlBase: "" },
  { sistema: "projudi", sistemaLabel: "Projudi", tribunal: "TJGO", tribunalLabel: "TJGO - Tribunal de Justiça de Goiás", uf: "GO", nome: "Projudi TJGO", urlBase: "" },
  { sistema: "projudi", sistemaLabel: "Projudi", tribunal: "TJPR", tribunalLabel: "TJPR - Tribunal de Justiça do Paraná", uf: "PR", nome: "Projudi TJPR", urlBase: "" },
  { sistema: "esaj", sistemaLabel: "ESAJ", tribunal: "TJSP", tribunalLabel: "TJSP - Tribunal de Justiça de São Paulo", uf: "SP", nome: "ESAJ TJSP", urlBase: "" },
];

const SISTEMAS = uniqueBy(CATALOG, (item) => item.sistema).map((item) => ({ value: item.sistema, label: item.sistemaLabel }));

export function ConectorTribunalForm({ conector, advogados }: { conector?: ConectorOption; advogados: AdvogadoOption[] }) {
  const initial = resolveInitial(conector);
  const [sistema, setSistema] = useState(initial.sistema);
  const [tribunal, setTribunal] = useState(initial.tribunal);
  const [uf, setUf] = useState(initial.uf);
  const [nome, setNome] = useState(initial.nome);
  const [urlBase, setUrlBase] = useState(initial.urlBase);

  const tribunais = useMemo(() => uniqueBy(CATALOG.filter((item) => item.sistema === sistema), (item) => item.tribunal), [sistema]);
  const ufs = useMemo(() => uniqueBy(CATALOG.filter((item) => item.sistema === sistema && item.tribunal === tribunal), (item) => item.uf), [sistema, tribunal]);
  const nomes = useMemo(() => CATALOG.filter((item) => item.sistema === sistema && item.tribunal === tribunal && item.uf === uf), [sistema, tribunal, uf]);

  function applySelection(next: Partial<Pick<CatalogItem, "sistema" | "tribunal" | "uf" | "nome">>) {
    const nextSistema = next.sistema ?? sistema;
    const firstTribunal = CATALOG.find((item) => item.sistema === nextSistema);
    const nextTribunal = next.tribunal ?? firstTribunal?.tribunal ?? "";
    const firstUf = CATALOG.find((item) => item.sistema === nextSistema && item.tribunal === nextTribunal);
    const nextUf = next.uf ?? firstUf?.uf ?? "";
    const firstNome = CATALOG.find((item) => item.sistema === nextSistema && item.tribunal === nextTribunal && item.uf === nextUf);
    const nextNome = next.nome ?? firstNome?.nome ?? "";
    const selected = CATALOG.find((item) => item.sistema === nextSistema && item.tribunal === nextTribunal && item.uf === nextUf && item.nome === nextNome);

    setSistema(nextSistema);
    setTribunal(nextTribunal);
    setUf(nextUf);
    setNome(nextNome);
    setUrlBase(selected?.urlBase ?? "");
  }

  return (
    <form className="field-grid" action={salvarConectorTribunalLexGestor}>
      {conector?.id ? <input type="hidden" name="id" value={conector.id} /> : null}
      <label className="field">
        Sistema judicial
        <select name="sistema" required value={sistema} onChange={(event) => applySelection({ sistema: event.target.value })}>
          {SISTEMAS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="field">
        Tribunal
        <select name="tribunal" required value={tribunal} onChange={(event) => applySelection({ tribunal: event.target.value })}>
          {tribunais.map((item) => <option value={item.tribunal} key={item.tribunal}>{item.tribunalLabel}</option>)}
        </select>
      </label>
      <label className="field">
        UF
        <select name="uf" required value={uf} onChange={(event) => applySelection({ uf: event.target.value })}>
          {ufs.map((item) => <option value={item.uf} key={item.uf}>{item.uf}</option>)}
        </select>
      </label>
      <label className="field">
        Nome do conector
        <select name="nome" required value={nome} onChange={(event) => applySelection({ nome: event.target.value })}>
          {nomes.map((item) => <option value={item.nome} key={item.nome}>{item.nome}</option>)}
        </select>
      </label>
      <label className="field-full">
        URL base
        <input name="url_base" type="url" value={urlBase} onChange={(event) => setUrlBase(event.target.value)} placeholder="Cole o link oficial do sistema" />
        <span className="field-hint">Use apenas endereço de navegação do tribunal.</span>
      </label>
      <label className="field">
        Advogado responsável
        <select name="advogado_id" defaultValue={conector?.advogadoId ?? ""}>
          <option value="">Escritório inteiro</option>
          {advogados.map((advogado) => <option value={advogado.id} key={advogado.id}>{advogado.nome}</option>)}
        </select>
      </label>
      <label className="field">
        Modo
        <select name="modo" defaultValue={conector?.modo ?? "fluxo_assistido"}>
          <option value="fluxo_assistido">Fluxo assistido</option>
          <option value="conector_local_futuro">Conector local futuro</option>
        </select>
      </label>
      <label className="field">
        Status
        <select name="status" defaultValue={conector?.status ?? "ativo"}>
          <option value="ativo">Ativo</option>
          <option value="pausado">Pausado</option>
          <option value="inativo">Inativo</option>
        </select>
      </label>
      <label className="field-full">
        Observações
        <textarea name="observacoes" defaultValue={conector?.observacoes ?? ""} placeholder="Instruções internas do escritório." />
      </label>
      <div className="button-row">
        <button className="button" type="submit">{conector ? "Atualizar conector" : "Salvar conector"}</button>
      </div>
    </form>
  );
}

function resolveInitial(conector?: ConectorOption) {
  const selected = CATALOG.find((item) => item.sistema === conector?.sistema && item.tribunal === conector?.tribunal && item.uf === conector?.uf && item.nome === conector?.nome)
    ?? CATALOG.find((item) => item.sistema === (conector?.sistema || "eproc") && item.tribunal === (conector?.tribunal || "TJTO"))
    ?? CATALOG[0];
  return {
    sistema: selected.sistema,
    tribunal: selected.tribunal,
    uf: selected.uf,
    nome: conector?.nome && CATALOG.some((item) => item.nome === conector.nome) ? conector.nome : selected.nome,
    urlBase: conector?.urlBase || selected.urlBase,
  };
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
