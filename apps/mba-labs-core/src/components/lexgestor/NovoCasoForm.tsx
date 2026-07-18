"use client";

import { useState } from "react";
import { FileText, Save } from "lucide-react";
import { salvarCasoLexGestor } from "@/app/lexgestor/actions";
import type { CategoriaJuridica } from "@/data/lexgestor/areas";
import { LEX_CASE_STATUS } from "@/lib/lexgestor/constants";
import type { LexAdvogado, LexCliente } from "@/lib/lexgestor/data";

type NovoCasoFormProps = {
  clientes: LexCliente[];
  advogados?: LexAdvogado[];
  categorias: CategoriaJuridica[];
  defaultClienteId?: string;
};

const TRIBUNAIS = [
  "TJTO - Tribunal de Justiça do Tocantins",
  "TRF1 - Tribunal Regional Federal da 1ª Região",
  "TRT10 - Tribunal Regional do Trabalho da 10ª Região",
  "TST - Tribunal Superior do Trabalho",
  "STJ - Superior Tribunal de Justiça",
  "STF - Supremo Tribunal Federal",
  "Outro tribunal",
];

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const COMARCAS_POR_UF: Record<string, string[]> = {
  TO: [
    "COMARCA DE PALMAS",
    "COMARCA DE ARAGUAÍNA",
    "COMARCA DE GURUPI",
    "COMARCA DE PORTO NACIONAL",
    "COMARCA DE PARAÍSO DO TOCANTINS",
    "COMARCA DE COLINAS DO TOCANTINS",
    "COMARCA DE GUARAÍ",
    "COMARCA DE DIANÓPOLIS",
    "COMARCA DE MIRACEMA DO TOCANTINS",
    "COMARCA DE TOCANTINÓPOLIS",
    "COMARCA DE ARAGUATINS",
    "COMARCA DE NATIVIDADE",
    "COMARCA DE ALVORADA",
    "COMARCA DE ARRAIAS",
    "COMARCA DE AUGUSTINÓPOLIS",
    "COMARCA DE FORMOSO DO ARAGUAIA",
    "COMARCA DE MIRANORTE",
    "COMARCA DE PEDRO AFONSO",
    "COMARCA DE TAGUATINGA",
    "COMARCA DE XAMBIOÁ",
  ],
  DF: ["SEÇÃO JUDICIÁRIA DO DISTRITO FEDERAL", "BRASÍLIA"],
  GO: ["COMARCA DE GOIÂNIA", "COMARCA DE APARECIDA DE GOIÂNIA", "COMARCA DE ANÁPOLIS", "COMARCA DE LUZIÂNIA"],
};

const VARAS = [
  "1ª VARA CÍVEL",
  "2ª VARA CÍVEL",
  "3ª VARA CÍVEL",
  "4ª VARA CÍVEL",
  "VARA DE FAMÍLIA E SUCESSÕES",
  "1ª VARA DE FAMÍLIA E SUCESSÕES",
  "2ª VARA DE FAMÍLIA E SUCESSÕES",
  "VARA DA FAZENDA E REGISTROS PÚBLICOS",
  "VARA CRIMINAL",
  "VARA DE EXECUÇÕES FISCAIS E SAÚDE",
  "JUIZADO ESPECIAL CÍVEL",
  "JUIZADO ESPECIAL CRIMINAL",
  "TURMA RECURSAL",
  "VARA DO TRABALHO",
  "VARA FEDERAL",
  "NÃO INFORMADA",
];

const CLASSES_PROCESSUAIS = [
  "AÇÃO DE DESPEJO",
  "AÇÃO DE ALIMENTOS",
  "AÇÃO DE DIVÓRCIO",
  "AÇÃO DE GUARDA",
  "AÇÃO DE COBRANÇA",
  "AÇÃO INDENIZATÓRIA",
  "AÇÃO DECLARATÓRIA",
  "EXECUÇÃO DE TÍTULO EXTRAJUDICIAL",
  "CUMPRIMENTO DE SENTENÇA",
  "MANDADO DE SEGURANÇA",
  "AGRAVO DE INSTRUMENTO",
  "APELAÇÃO CÍVEL",
  "PROCESSO CRIMINAL",
  "INQUÉRITO POLICIAL",
  "RECLAMAÇÃO TRABALHISTA",
  "BENEFÍCIO PREVIDENCIÁRIO",
  "OUTRA CLASSE",
];

const ASSUNTOS = [
  "AÇÃO DE DESPEJO",
  "PENSÃO ALIMENTÍCIA",
  "GUARDA DE MENOR",
  "DIVÓRCIO",
  "DANOS MORAIS",
  "DANOS MATERIAIS",
  "COBRANÇA",
  "CONTRATO",
  "CONSUMIDOR",
  "FAMÍLIA",
  "CRIMINAL",
  "TRABALHISTA",
  "PREVIDENCIÁRIO",
  "FAZENDA PÚBLICA",
  "OUTRO ASSUNTO",
];

const FASES_PROCESSUAIS = [
  "Atendimento inicial",
  "Pré-processual",
  "Aguardando documentos",
  "Petição inicial",
  "Distribuído",
  "Citação/intimação",
  "Audiência designada",
  "Contestação",
  "Réplica",
  "Instrução",
  "Sentença",
  "Recurso",
  "Cumprimento de sentença",
  "Execução",
  "Arquivado",
];

const TIPOS_PRAZO = [
  "Audiência",
  "Contestação",
  "Réplica",
  "Recurso",
  "Manifestação",
  "Cumprimento de despacho",
  "Juntar documentos",
  "Pagamento/custas",
  "Retorno ao cliente",
  "Outro prazo",
];

export function NovoCasoForm({ clientes, advogados = [], categorias, defaultClienteId = "" }: NovoCasoFormProps) {
  const defaultClienteValido = clientes.some((cliente) => cliente.id === defaultClienteId) ? defaultClienteId : "";
  const [clienteId, setClienteId] = useState(defaultClienteValido);
  const [categoria, setCategoria] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const [uf, setUf] = useState("TO");
  const [comarca, setComarca] = useState("COMARCA DE PALMAS");
  const selected = categorias.find((item) => item.nome === categoria);
  const comarcas = COMARCAS_POR_UF[uf] ?? [];

  return (
    <form className="stack novo-caso-simples" action={salvarCasoLexGestor}>
      <section className="form-card stack">
        <div className="section-title compact-title">
          <div>
            <h2>Dados do caso</h2>
          </div>
        </div>

        <div className="field-grid case-essential-grid">
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
            Título
            <input name="titulo" placeholder="Ex.: Ação de despejo" required />
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

          <label className="field">
            Próximo prazo
            <input name="proximo_prazo" type="date" />
          </label>

          <SelectField name="tipo_prazo" label="Tipo de prazo" options={TIPOS_PRAZO} />

          <label className="field-full">
            Relato inicial
            <textarea name="relato_inicial" placeholder="Resumo do atendimento" />
          </label>
        </div>
      </section>

      <section className="form-card stack">
        <details className="simple-details">
          <summary>Processo judicial</summary>
          <div className="field-grid case-essential-grid details-grid">
            <Field name="numero_processo" label="Número do processo" />
            <Field name="chave_processo" label="Chave eproc" />
            <SelectField name="sistema_judicial" label="Sistema" options={["eproc", "PJe", "Projudi", "ESAJ", "Outro"]} />
            <SelectField name="tribunal" label="Tribunal" options={TRIBUNAIS} defaultValue="TJTO - Tribunal de Justiça do Tocantins" />
          </div>
        </details>

        <details className="simple-details">
          <summary>Mais informações</summary>
          <div className="field-grid details-grid">
            <label className="field">
              UF
              <select
                name="uf"
                value={uf}
                onChange={(event) => {
                  const value = event.target.value;
                  setUf(value);
                  setComarca((COMARCAS_POR_UF[value] ?? [""])[0] ?? "");
                }}
              >
                <option value="">Não informado</option>
                {UFS.map((item) => (
                  <option value={item} key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="field">
              Comarca
              {comarcas.length > 0 ? (
                <select name="comarca" value={comarca} onChange={(event) => setComarca(event.target.value)}>
                  <option value="">Não informado</option>
                  {comarcas.map((item) => (
                    <option value={item} key={item}>{item}</option>
                  ))}
                  <option value="OUTRA COMARCA/SUBSEÇÃO">OUTRA COMARCA/SUBSEÇÃO</option>
                </select>
              ) : (
                <select name="comarca" defaultValue="">
                  <option value="">Não informado</option>
                  <option value="OUTRA COMARCA/SUBSEÇÃO">OUTRA COMARCA/SUBSEÇÃO</option>
                </select>
              )}
            </label>

            <SelectField name="vara" label="Vara" options={VARAS} />
            <SelectField name="classe_processual" label="Classe" options={CLASSES_PROCESSUAIS} />
            <SelectField name="assunto" label="Assunto" options={ASSUNTOS} />
            <SelectField name="fase_processual" label="Fase" options={FASES_PROCESSUAIS} />

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
              Responsável
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
              Distribuição
              <input name="data_distribuicao" type="date" />
            </label>

            <Field name="link_processo" label="Link do processo" />

            <label className="field-full">
              Observações
              <textarea name="observacoes_processo" placeholder="Observações" />
            </label>
          </div>
        </details>
      </section>

      <div className="button-row sticky-actions">
        <button className="button" type="submit">
          <Save size={17} aria-hidden />
          Salvar caso
        </button>
        <a className="button secondary" href={clienteId ? `/lexgestor/documentos?cliente=${clienteId}` : "/lexgestor/documentos"}>
          <FileText size={17} aria-hidden />
          Documentos
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

function SelectField({
  name,
  label,
  options,
  defaultValue = "",
}: {
  name: string;
  label: string;
  options: string[];
  defaultValue?: string;
}) {
  return (
    <label className="field">
      {label}
      <select name={name} defaultValue={defaultValue}>
        <option value="">Não informado</option>
        {options.map((item) => (
          <option value={item} key={item}>{item}</option>
        ))}
      </select>
    </label>
  );
}
