import { createHmac, timingSafeEqual } from "crypto";

function registrationSecret() {
  const secret = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!secret) {
    throw new Error("Configuração segura do cadastro de membros não encontrada.");
  }
  return secret;
}

export function createElshadayMemberRegistrationToken(igrejaId: string) {
  return createHmac("sha256", registrationSecret())
    .update("elshaday-member-registration:" + igrejaId)
    .digest("hex")
    .slice(0, 40);
}

export function validateElshadayMemberRegistrationToken(igrejaId: string, token: string) {
  const expected = createElshadayMemberRegistrationToken(igrejaId);
  const received = String(token ?? "").trim();

  if (received.length !== expected.length) return false;

  return timingSafeEqual(
    Buffer.from(received, "utf8"),
    Buffer.from(expected, "utf8")
  );
}
