/** Pure mathematical calculations. Inputs are not agronomic recommendations. */
function positive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0 || value > 1e9) throw new Error(`${label}: informe valor positivo até 1 bilhão.`);
  return value;
}
function nonnegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1e9) throw new Error(`${label}: informe valor entre zero e 1 bilhão.`);
  return value;
}
export function calculateLoads(areaHa: number, rateLHa: number, capacityL: number) {
  positive(areaHa, 'Área'); positive(rateLHa, 'Taxa'); positive(capacityL, 'Capacidade');
  const totalL = areaHa * rateLHa;
  const quotient = totalL / capacityL;
  if (!Number.isFinite(quotient) || quotient > Number.MAX_SAFE_INTEGER) throw new Error('Número de cargas fora do limite de precisão.');
  const nearest = Math.round(quotient);
  const exact = nearest >= 1 && Math.abs(quotient - nearest) <= Number.EPSILON * Math.max(1, quotient) * 8;
  const fullLoads = exact ? nearest : Math.floor(quotient);
  const partialL = exact ? 0 : totalL - fullLoads * capacityL;
  return { totalL, areaPerLoadHa: capacityL / rateLHa, fullLoads, partialLoads: partialL > 0 ? 1 : 0,
    loads: fullLoads + (partialL > 0 ? 1 : 0), lastL: partialL || capacityL, partialL };
}
export type DoseUnit = 'L/ha' | 'mL/ha' | 'kg/ha' | 'g/ha';
export function calculateProduct(dose: number, unit: DoseUnit, areaHa: number) {
  nonnegative(dose, 'Dose'); nonnegative(areaHa, 'Área');
  if (!['L/ha', 'mL/ha', 'kg/ha', 'g/ha'].includes(unit)) throw new Error('Unidade inválida.');
  const amount = dose * areaHa;
  return { amount, unit: unit.split('/')[0], baseAmount: amount / (unit === 'mL/ha' || unit === 'g/ha' ? 1000 : 1),
    baseUnit: unit === 'L/ha' || unit === 'mL/ha' ? 'L' : 'kg' };
}
export function calculateFlow(rateLHa: number, speedKmh: number, widthM: number) {
  return positive(rateLHa, 'Taxa') * positive(speedKmh, 'Velocidade') * positive(widthM, 'Faixa') / 600;
}
export function calculateYield(input: { areaHa: number; speedKmh: number; widthM: number; rateLHa: number; tankL: number; refillMin: number; batteryMin: number; travelMin: number; efficiencyPercent: number }) {
  const loads = calculateLoads(input.areaHa, input.rateLHa, input.tankL);
  const theoreticalHaH = positive(input.speedKmh, 'Velocidade') * positive(input.widthM, 'Faixa') / 10;
  const efficiency = positive(input.efficiencyPercent, 'Eficiência');
  if (efficiency > 100) throw new Error('Eficiência não pode superar 100%.');
  const applicationHours = input.areaHa / theoreticalHaH / (efficiency / 100);
  const groundHours = (loads.loads * (nonnegative(input.refillMin, 'Abastecimento') + nonnegative(input.batteryMin, 'Bateria')) + nonnegative(input.travelMin, 'Deslocamento')) / 60;
  const totalHours = applicationHours + groundHours;
  return { theoreticalHaH, estimatedHaH: input.areaHa / totalHours, totalHours, loads: loads.loads, applicationHours, groundHours };
}
export function calculateFinance(input: { areaHa: number; priceHa: number; variableHa: number; fixed: number; investment: number; monthlyHa: number }) {
  positive(input.areaHa, 'Área'); nonnegative(input.priceHa, 'Preço'); nonnegative(input.variableHa, 'Custo variável');
  nonnegative(input.fixed, 'Custo fixo'); nonnegative(input.investment, 'Investimento'); nonnegative(input.monthlyHa, 'Área mensal');
  const revenue = input.areaHa * input.priceHa, cost = input.areaHa * input.variableHa + input.fixed;
  const profit = revenue - cost, contributionHa = input.priceHa - input.variableHa;
  const monthlyProfit = input.monthlyHa * contributionHa - input.fixed;
  return { revenue, cost, profit, costHa: cost / input.areaHa, marginPercent: revenue > 0 ? profit / revenue * 100 : null,
    breakEvenHa: contributionHa > 0 ? input.fixed / contributionHa : null,
    roiPercent: input.investment > 0 ? profit / input.investment * 100 : null,
    paybackMonths: input.investment > 0 && monthlyProfit > 0 ? input.investment / monthlyProfit : null };
}

/** Quantity for a confirmed final volume. Supports existing concentration units without converting mass to volume. */
export type ApplicationDoseUnit = DoseUnit | 'mL/100L' | 'g/100L';
export function calculateProductForVolume(dose: number, unit: ApplicationDoseUnit, volumeL: number, rateLHa: number) {
  positive(volumeL, 'Volume final'); positive(rateLHa, 'Taxa de aplicação'); nonnegative(dose, 'Dose');
  if (unit === 'mL/100L' || unit === 'g/100L') {
    const amount = dose * volumeL / 100;
    return { amount, unit: unit === 'mL/100L' ? 'mL' : 'g' };
  }
  return calculateProduct(dose, unit, volumeL / rateLHa);
}
