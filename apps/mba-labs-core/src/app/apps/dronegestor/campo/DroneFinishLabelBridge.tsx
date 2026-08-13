"use client";

import { useEffect } from "react";

const replacements = new Map([
  ["Concluir e salvar no histórico", "Finalizar operação"],
  ["Operação salva", "Operação registrada"],
  ["100% da área real registrada. Agora a conclusão definitiva está liberada.", "100% da área real registrada. Agora você pode finalizar a operação e conferir o pacote documental."]
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
