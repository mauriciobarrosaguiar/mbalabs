/** Navigation guards do not authorize execution; preflight remains server validated. */
export function droneDeviceSwitchIssue(storage: Pick<Storage, "getItem">, targetOsId: string) {
  try {
    const mission = JSON.parse(storage.getItem("dronegestor:mission:v2") || "{}");
    if (mission.ordemServicoId === targetOsId) return "";
    const status = JSON.parse(storage.getItem("dronegestor:missionStatus:v4") || '"rascunho"');
    const started = JSON.parse(storage.getItem("dronegestor:started:v3") || "false");
    const paused = JSON.parse(storage.getItem("dronegestor:paused:v3") || "false");
    const operationId = storage.getItem("dronegestor:operationId:v3");
    const progress = Number(JSON.parse(storage.getItem("dronegestor:progress:v2") || "0"));
    const tanks = JSON.parse(storage.getItem("dronegestor:tankRecords:v4") || "[]");
    const queue = JSON.parse(storage.getItem("dronegestor:finalizationQueue:v4") || "[]");
    if (started || paused || status === "pausada" || status === "pendente_sync" || queue.length ||
        (status !== "finalizada" && (operationId || progress > 0 || tanks.length))) {
      return "Existe uma aplicação em andamento, pausada ou pendente de sincronização neste aparelho. Recupere e conclua essa operação antes de trocar de OS.";
    }
    return "";
  } catch {
    return "Não foi possível validar o estado local da operação. Recupere o checkpoint antes de trocar de OS.";
  }
}
