"use client";

import { MessageCircle } from "lucide-react";
import { abrirWhatsAppCliente } from "@/lib/lexgestor/whatsapp";

type BotaoWhatsAppClienteProps = {
  telefone: string;
  mensagem?: string;
};

export function BotaoWhatsAppCliente({
  telefone,
  mensagem,
}: BotaoWhatsAppClienteProps) {
  return (
    <button
      className="button secondary"
      type="button"
      onClick={() => {
        window.open(abrirWhatsAppCliente(telefone, mensagem), "_blank", "noopener,noreferrer");
      }}
    >
      <MessageCircle size={17} aria-hidden />
      Abrir WhatsApp do cliente
    </button>
  );
}
