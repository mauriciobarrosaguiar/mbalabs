export type WhatsappDeliveryTarget = {
  phone: string;
  mock: boolean;
  messagePrefix: string;
};

export function normalizeWhatsappPhone(value?: string | null) {
  let digits = String(value ?? "").replace(/\D/g, "");
  while (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}

export function resolveWhatsappDeliveryTarget(
  value?: string | null,
  environment: Record<string, string | undefined> = process.env,
): WhatsappDeliveryTarget {
  const originalPhone = normalizeWhatsappPhone(value);
  if (environment.WHATSAPP_TEST_MODE !== "true") {
    return { phone: originalPhone, mock: false, messagePrefix: "" };
  }

  const configuredDestination = normalizeWhatsappPhone(environment.WHATSAPP_TEST_DESTINATION);
  const phone = configuredDestination || originalPhone;
  const allowlist = new Set(
    String(environment.WHATSAPP_TEST_ALLOWLIST ?? "")
      .split(",")
      .map((item) => normalizeWhatsappPhone(item))
      .filter(Boolean),
  );

  if (allowlist.size === 0) {
    throw new Error("Modo de teste do WhatsApp exige WHATSAPP_TEST_ALLOWLIST.");
  }
  if (!allowlist.has(phone)) {
    throw new Error("Envio de teste bloqueado: destino fora da allowlist.");
  }

  return {
    phone,
    mock: environment.WHATSAPP_TEST_MOCK === "true",
    messagePrefix: "[MBA COTAÇÕES QA] ",
  };
}
