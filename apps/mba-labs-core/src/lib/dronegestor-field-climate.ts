/** Checks only whether on-site measurements were entered within existing
 * input sanity ranges. It does NOT approve spray-weather conditions or
 * replace the label, agronomist's protocol, or field safety inspection.
 */
export type DroneFieldClimateInput = {
  ventoCampoKmh: number | null;
  direcaoVentoCampo: string;
  temperaturaCampo: number | null;
  umidadeCampo: number | null;
};

export function hasCompleteDroneFieldClimate(input: DroneFieldClimateInput): boolean {
  const wind = input.ventoCampoKmh;
  const temperature = input.temperaturaCampo;
  const humidity = input.umidadeCampo;
  return Boolean(
    typeof input.direcaoVentoCampo === "string" &&
    input.direcaoVentoCampo.trim() &&
    wind !== null && Number.isFinite(wind) && wind >= 0 && wind <= 100 &&
    temperature !== null && Number.isFinite(temperature) && temperature >= -20 && temperature <= 60 &&
    humidity !== null && Number.isFinite(humidity) && humidity > 0 && humidity <= 100
  );
}
