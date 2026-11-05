export function normalizeBuyerCnpj(value: string) {
  return value.trim().toUpperCase().replace(/[./-]/g, "");
}

export function formatBuyerCnpj(value: string) {
  const document = normalizeBuyerCnpj(value);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(document) || /^(\d)\1{13}$/.test(document)) return "";

  const checksum = (base: string) => {
    let sum = 0;
    for (let index = 0; index < base.length; index += 1) {
      sum += (base.charCodeAt(index) - 48) * (2 + ((base.length - index - 1) % 8));
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const base = document.slice(0, 12);
  const first = checksum(base);
  if (document.slice(12) !== `${first}${checksum(base + first)}`) return "";
  return document.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5");
}

export type BuyerPharmacyOption = {
  id: string;
  name: string;
  legalName: string;
  formattedCnpj: string;
  status: "ativo";
};
