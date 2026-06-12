import type { PurchaseOrder } from "@/lib/types";

export function getPurchaseOrderSupplierCompany(order: PurchaseOrder) {
  return clean(order.supplierCompany) ?? clean(order.supplierName) ?? "Fornecedor";
}

export function getPurchaseOrderSupplierContact(order: PurchaseOrder) {
  const contact = clean(order.supplierContactName);
  if (!contact) return undefined;

  const company = getPurchaseOrderSupplierCompany(order);
  return normalize(contact) === normalize(company) ? undefined : contact;
}

export function getPurchaseOrderSupplierDisplay(order: PurchaseOrder) {
  const company = getPurchaseOrderSupplierCompany(order);
  const contact = getPurchaseOrderSupplierContact(order);
  return contact ? `${company} - ${contact}` : company;
}

function clean(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
