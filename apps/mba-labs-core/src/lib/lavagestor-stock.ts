export const LAVA_ESTOQUE_CATEGORIAS = [
  "Químicos",
  "Acabamento",
  "Limpeza interna",
  "Panos e acessórios",
  "Consumo geral",
  "Revenda"
];

export const LAVA_ESTOQUE_UNIDADES = [
  { value: "un", label: "Unidade", base: "un", factor: 1 },
  { value: "ml", label: "Mililitro", base: "l", factor: 0.001 },
  { value: "l", label: "Litro", base: "l", factor: 1 },
  { value: "g", label: "Grama", base: "kg", factor: 0.001 },
  { value: "kg", label: "Quilo", base: "kg", factor: 1 },
  { value: "pct", label: "Pacote", base: "un", factor: 1 },
  { value: "cx", label: "Caixa", base: "un", factor: 1 }
];

export function normalizeStockUnit(value: unknown, fallback = "un") {
  const unit = String(value ?? "").trim().toLowerCase();
  return LAVA_ESTOQUE_UNIDADES.some((item) => item.value === unit) ? unit : fallback;
}

export function baseUnitFor(unit: unknown) {
  const normalized = normalizeStockUnit(unit);
  return LAVA_ESTOQUE_UNIDADES.find((item) => item.value === normalized)?.base ?? normalized;
}

export function convertToBaseQuantity(quantity: number, movementUnit: unknown, productBaseUnit: unknown) {
  const unit = normalizeStockUnit(movementUnit);
  const targetBase = normalizeStockUnit(productBaseUnit, baseUnitFor(unit));
  const item = LAVA_ESTOQUE_UNIDADES.find((option) => option.value === unit);

  if (!item) return quantity;
  if (item.base === targetBase || item.value === targetBase) return roundStock(quantity * item.factor);
  return quantity;
}

export function formatStockQuantity(value: unknown, unit: unknown) {
  const number = Number(value ?? 0);
  const safe = Number.isFinite(number) ? number : 0;
  return `${safe.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${normalizeStockUnit(unit)}`;
}

export function roundStock(value: number) {
  return Math.round(value * 1000) / 1000;
}
