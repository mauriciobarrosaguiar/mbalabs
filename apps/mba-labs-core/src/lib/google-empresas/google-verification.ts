import "server-only";
import type { GoogleEmpresa } from "./data";
import { googleRequest } from "./google-client";
import { buildPostalAddress } from "./google-location-payload";

export async function fetchGoogleVerificationOptions(accessToken: string, locationName: string, empresa?: GoogleEmpresa) {
  const body: Record<string, unknown> = { languageCode: "pt-BR" };

  if (empresa?.tipo_atendimento === "area_servico" && empresa.endereco_linha1) {
    body.context = { address: buildPostalAddress(empresa) };
  }

  const result = await googleRequest<{ options?: Array<Record<string, any>> }>(
    `https://mybusinessverifications.googleapis.com/v1/${locationName}:fetchVerificationOptions`,
    accessToken,
    { method: "POST", body: JSON.stringify(body) }
  );
  return result.options ?? [];
}

export async function startGoogleBusinessVerification({
  accessToken,
  locationName,
  method,
  emailUserName,
  phoneNumber,
  mailerContact,
  empresa
}: {
  accessToken: string;
  locationName: string;
  method: string;
  emailUserName?: string;
  phoneNumber?: string;
  mailerContact?: string;
  empresa?: GoogleEmpresa;
}): Promise<Record<string, any>> {
  const body: Record<string, unknown> = { method, languageCode: "pt-BR" };

  if (empresa?.tipo_atendimento === "area_servico" && empresa.endereco_linha1) {
    body.context = { address: buildPostalAddress(empresa) };
  }

  if (method === "EMAIL" && emailUserName) body.emailAddress = emailUserName;
  if (["PHONE_CALL", "SMS"].includes(method) && phoneNumber) body.phoneNumber = phoneNumber;
  if (method === "ADDRESS") body.mailerContact = mailerContact || empresa?.nome || "Responsável pela empresa";

  const result = await googleRequest<{ verification?: Record<string, any> }>(
    `https://mybusinessverifications.googleapis.com/v1/${locationName}:verify`,
    accessToken,
    { method: "POST", body: JSON.stringify(body) }
  );

  return result.verification ?? (result as Record<string, any>);
}

export async function completeGoogleBusinessVerification(accessToken: string, verificationName: string, pin: string) {
  return googleRequest<Record<string, any>>(
    `https://mybusinessverifications.googleapis.com/v1/${verificationName}:complete`,
    accessToken,
    { method: "POST", body: JSON.stringify({ pin }) }
  );
}

export async function listGoogleBusinessVerifications(accessToken: string, locationName: string) {
  const result = await googleRequest<{ verifications?: Array<Record<string, any>> }>(
    `https://mybusinessverifications.googleapis.com/v1/${locationName}/verifications`,
    accessToken
  );
  return result.verifications ?? [];
}
