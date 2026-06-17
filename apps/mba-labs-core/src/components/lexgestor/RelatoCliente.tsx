"use client";

import { useState } from "react";
import { CheckCircle2, FileText, Save, UploadCloud } from "lucide-react";

export function RelatoCliente() {
  const [texto, setTexto] = useState("");

  return (
    <section className="form-card stack">
      <div>
        <h2>Relato do cliente</h2>
        <p>
          Registre os fatos em linguagem simples. Depois gere PDF e envie ao armazenamento conectado.
        </p>
      </div>
      <label className="field-full">
        O que aconteceu, datas, pessoas, local, testemunhas, provas, pedido do
        cliente e observacoes do advogado
        <textarea
          value={texto}
          onChange={(event) => setTexto(event.target.value)}
          placeholder="Digite ou cole aqui o relato inicial do atendimento."
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
          <UploadCloud size={17} aria-hidden />
          Enviar relato para Dropbox
        </button>
        <button className="button secondary" type="button">
          <CheckCircle2 size={17} aria-hidden />
          Marcar como conferido
        </button>
      </div>
      <span className="badge warning">
        {texto.length > 0 ? `${texto.length} caracteres` : "Aguardando relato"}
      </span>
    </section>
  );
}
