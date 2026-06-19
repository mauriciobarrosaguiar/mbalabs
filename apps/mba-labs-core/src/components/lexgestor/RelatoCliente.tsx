"use client";

import { useRef, useState } from "react";
import { Bold, FileText, Italic, List, ListOrdered, Paperclip, Save } from "lucide-react";

export function RelatoCliente() {
  const [texto, setTexto] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function wrapSelection(prefix: string, suffix = prefix) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = texto.slice(start, end) || "texto";
    const next = `${texto.slice(0, start)}${prefix}${selected}${suffix}${texto.slice(end)}`;
    setTexto(next);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  }

  function addLine(prefix: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const before = texto.slice(0, start);
    const after = texto.slice(start);
    const next = `${before}${before && !before.endsWith("\n") ? "\n" : ""}${prefix} ${after}`;
    setTexto(next);
    setTimeout(() => textarea.focus(), 0);
  }

  return (
    <section className="form-card stack">
      <div>
        <h2>Relato do cliente</h2>
        <p>Registre os fatos em linguagem simples. Use os botões para organizar o texto antes de gerar o PDF.</p>
      </div>
      <div className="button-row" aria-label="Formatação do relato">
        <button className="button secondary" type="button" onClick={() => wrapSelection("**")}>
          <Bold size={17} aria-hidden /> Negrito
        </button>
        <button className="button secondary" type="button" onClick={() => wrapSelection("_")}>
          <Italic size={17} aria-hidden /> Itálico
        </button>
        <button className="button secondary" type="button" onClick={() => addLine("-")}>
          <List size={17} aria-hidden /> Lista
        </button>
        <button className="button secondary" type="button" onClick={() => addLine("1.")}>
          <ListOrdered size={17} aria-hidden /> Numerar
        </button>
      </div>
      <label className="field-full">
        O que aconteceu, datas, pessoas, local, testemunhas, provas, pedido do cliente e observações do advogado
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          placeholder="Digite ou cole aqui o relato inicial do atendimento. Ex.: **ponto importante**"
          style={{ minHeight: 180 }}
        />
      </label>
      <div className="button-row">
        <button className="button" type="button">
          <Save size={17} aria-hidden />
          Salvar relato
        </button>
        <button className="button secondary" type="button">
          <FileText size={17} aria-hidden />
          Gerar PDF do relato
        </button>
        <button className="button secondary" type="button">
          <Paperclip size={17} aria-hidden />
          Anexar relato existente
        </button>
      </div>
      <span className="badge warning">
        {texto.length > 0 ? `${texto.length} caracteres` : "Aguardando relato"}
      </span>
    </section>
  );
}
