/** Controller-screen reference photos must never satisfy post-flight map evidence.
 * Legacy uploads without purpose remain in the post-flight category.
 */
export type DroneMapPhotoPurpose = "planejamento" | "pos_voo";

export function mapPhotoPurpose(value: unknown): DroneMapPhotoPurpose {
  return value === "planejamento" ? "planejamento" : "pos_voo";
}

export function mapPhotoLogAction(purpose: DroneMapPhotoPurpose): string {
  return purpose === "planejamento" ? "mapa_controle_foto_v1" : "mapa_voo_evidencia";
}
