"use client";

import { useEffect } from "react";

const replacements = new Map([
  ["Concluir e salvar no histórico", "Concluir aplicação em campo"],
  ["Operação salva", "Aplicação de campo registrada"],
  ["Operação salva no histórico", "Aplicação de campo registrada no histórico"],
  ["Operação e OS concluídas e salvas no histórico.", "Aplicação em campo concluída e salva. Agora confira o pacote documental para encerrar a OS."],
  ["100% da área real registrada. Agora a conclusão definitiva está liberada.", "100% da área real registrada. Conclua a aplicação em campo; o encerramento da OS será feito depois da conferência documental."],
  ["100% da área planejada foi atingida pelos registros reais. Confira volumes, ocorrências e conclua.", "100% da área planejada foi registrada. Confira volumes e ocorrências e conclua a aplicação em campo."],
]);

function applyLabels() {
  if (typeof document === "undefined") return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const current = node.nodeValue?.trim() || "";
    const replacement = replacements.get(current);
    if (replacement && node.nodeValue) node.nodeValue = node.nodeValue.replace(current, replacement);
    node = walker.nextNode();
  }
}

export function DroneFinishLabelBridge() {
  useEffect(() => {
    applyLabels();
    const observer = new MutationObserver(applyLabels);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  return null;
}
