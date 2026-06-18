"use client";

import { useMemo, useState } from "react";
import { ClipboardList, FileText, Save } from "lucide-react";
import { salvarCasoLexGestor } from "@/app/lexgestor/actions";
import type { CategoriaJuridica } from "@/data/lexgestor/areas";
import { obterChecklistPorAreaSubarea } from "@/lib/lexgestor/checklist";
import { LEX_CASE_STATUS } from "@/lib/lexgestor/constants";
import type { LexAdvogado, LexCliente } from "@/lib/lexgestor/data";
import { ChecklistCaso } from "./ChecklistCaso";

type NovoCasoFormProps = {
  clientes: LexCliente[];
  advogados?: LexAdvogado[];
  categorias: CategoriaJuridica[];
  defaultClienteId?: string;
};

export function NovoCasoForm({ clientes, advogados = [], categorias, defaultClienteId = "" }: NovoCasoFormProps) {
  const defaultClienteValido = clientes.some((cliente) => cliente.id === defaultClienteId) ? defaultClienteId : "";
  const [clienteId, setClienteId] = useState(defaultClienteValido);
  const [categoria, setCategoria] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const checklist = useMemo(
    () => obterChecklistPorAreaSubarea(categoria, subcategoria),
    [categoria, subcategoria],
  );
  const selected = categorias.find((item) => item.nome === categoria);
  const clienteSelecionado = clientes.find((cliente) => cliente.id === clienteId);

  return (
    <form className="stack" action={salvarCasoLexGestor}>
      <section className="form-card stack">
        <div className="section-title">
          <div>
            <h2>1. Dados principais</h2>
            <p>O caso pode ser aberto antes de existir número de processo.</p>
          </div>
          <span className="badge">Próxima ação: preencher categoria</span>
        </div>

        {clienteSelecionado ? (
          <div className="notice success">
            Caso será vinculado ao cliente: <strong>{clienteSelecionado.nome}</strong>
          </div>
        ) : null}

        <div className="field-grid">
          <label className="field">
            Cliente
            <select
              name="cliente_id"
              value={clienteId}
              onChange={(event) => setClienteId(event.target.value)}
              required
            >
              <option value="">Escolha o cliente</option>
              {clientes.map((cliente) => (
                <option value={cliente.id} key={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Título do caso
            <input name="titulo" placeholder="Ex.: Pedido de benefício negado" required />
          </label>
          <label className="field">
            Categoria
            <select
              name="categoria"
              required
              value={categoria}
              onChange={(event) => {
                setCategoria(event.target.value);
                setSubcategoria("");
              }}
            >
              <option value="">Escolha a categoria</option>
              {categorias.map((item) => (
                <option value={item.nome} key={item.nome}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Subcategoria
            <select
              name="subcategoria"
              required
              disabled={!categoria}
              value={subcategoria}
              onChange={(event) => setSubcategoria(event.target.value)}
            >
              <option value="">
                {categoria ? "Escolha a subcategoria" : "Escolha a categoria primeiro"}
              </option>
              {(selected?.subcategorias ?? []).map((item) => (
                <option value={item.nome} key={item.nome}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Status
            <select name="status" defaultValue="Atendimento inicial">
              {LEX_CASE_STATUS.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="field">
            Prioridade
            <select name="prioridade" defaultValue="Normal">
              <option>Baixa</option>
              <option>Normal</option>
              <option>Alta</option>
              <option>Urgente</option>
            </select>
          </label>
          <label className="field-full">
            Relato inicial
            <textarea name="relato_inicial" placeholder="Resumo simples do atendimento, pedido do cliente e provas conhecidas." />
          </label>
        </div>
      </section>

      <section className="form-card stack">
        <div className="section-title">
          <div>
            <h2>2. Dados do processo</h2>
            <p>Todos os campos são opcionais. Não informe senha do eproc.</p>
          </div>
          <span className="badge warning">Não salvar login ou senha</span>
        </div>
        <div className="field-grid">
          <Field name="numero_processo" label="Número do processo" />
          <Field name="chave_processo" label="Chave do processo / eproc" />
          <label className="field">
            Sistema judicial
            <select name="sistema_judicial" defaultValue="">
              <option value="">Não informado</option>
              <option>eproc</option>
              <option>PJe</option>
              <option>Projudi</option>
              <option>ESAJ</option>
              <option>Outro</option>
            </select>
          </label>
          <Field name="tribunal" label="Tribunal" />
          <Field name="uf" label="Estado/UF" maxLength={2} />
          <Field name="comarca" label="Comarca/Subseção" />
          <Field name="vara" label="Vara" />
          <Field name="classe_processual" label="Classe processual" />
          <Field name="assunto" label="Assunto" />
          <Field name="fase_processual" label="Fase do processo" />
          <label className="field">
            Grau
            <select name="grau" defaultValue="">
              <option value="">Não informado</option>
              <option>1º grau</option>
              <option>2º grau</option>
              <option>Turma Recursal</option>
              <option>Superior</option>
            </select>
          </label>
          <Field name="polo_ativo" label="Polo ativo" />
          <Field name="polo_passivo" label="Polo passivo" />
          <label className="field">
            Advogado responsável
            <select name="advogado_responsavel_id" defaultValue="">
              <option value="">Definir depois</option>
              {advogados.filter((advogado) => advogado.status === "Ativo").map((advogado) => (
                <option value={advogado.id} key={advogado.id}>
                  {advogado.nome}{advogado.oab ? ` - OAB ${advogado.oab}/${advogado.ufOab}` : ""}
                </option>
              ))}
            </select>
          </label>
          <Field name="valor_causa" label="Valor da causa" inputMode="decimal" />
          <label className="field">
            Justiça gratuita
            <select name="justica_gratuita" defaultValue="nao">
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </label>
          <label className="field">
            Segredo de justiça
            <select name="segredo_justica" defaultValue="nao">
              <option value="nao">Não</option>
              <option value="sim">Sim</option>
            </select>
          </label>
          <label className="field">
            Data de distribuição
            <input name="data_distribuicao" type="date" />
          </label>
          <label className="field">
            Próximo prazo
            <input name="proximo_prazo" type="date" />
          </label>
          <Field name="tipo_prazo" label="Tipo de prazo" />
          <Field name="link_processo" label="Link do processo" />
          <label className="field-full">
            Observações do processo
            <textarea name="observacoes_processo" placeholder="Informações processuais importantes." />
          </label>
        </div>
      </section>

      <section className="form-card stack">
        <div className="section-title">
          <div>
            <h2>3. Checklist automático</h2>
            <p>Gerado conforme categoria e subcategoria escolhidas.</p>
          </div>
          <ClipboardList size={24} color="var(--primary)" aria-hidden />
        </div>
        <ChecklistCaso items={checklist} />
      </section>

      <div className="button-row sticky-actions">
        <button className="button" type="submit">
          <Save size={17} aria-hidden />
          Revisar e salvar caso
        </button>
        <a className="button secondary" href={clienteId ? `/lexgestor/documentos?cliente=${clienteId}` : "/lexgestor/documentos"}>
          <FileText size={17} aria-hidden />
          Anexar documentos depois
        </a>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  maxLength,
  inputMode,
}: {
  name: string;
  label: string;
  maxLength?: number;
  inputMode?: "decimal";
}) {
  return (
    <label className="field">
      {label}
      <input name={name} placeholder={label} maxLength={maxLength} inputMode={inputMode} />
    </label>
  );
}
