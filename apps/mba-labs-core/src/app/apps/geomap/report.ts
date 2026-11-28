export const PRODUCTS = [
  "Ortomosaico (GeoTIFF)", "MDT (GeoTIFF)", "MDS (GeoTIFF)",
  "Curvas de nível", "Mapa de declividade", "Nuvem de pontos",
  "Modelo 3D", "Limites (KML/KMZ)", "Relatório de processamento"
] as const;
export type ReportInput = {
  project: string; client: string; operator: string; location: string;
  flightDate: string; equipment: string; purpose: string; crs: string;
  photos: string; gsd: string; methodology: string; limitations: string;
  products: string[];
};
export const RETENTION_HOURS = 168;
export function expiryFromCompletion(completedAt: string): string {
  const ms = Date.parse(completedAt);
  if (!Number.isFinite(ms)) throw new Error("Data de conclusão inválida");
  return new Date(ms + RETENTION_HOURS * 3600_000).toISOString();
}
export function canDownload(completedAt: string, now: number): boolean {
  const start = Date.parse(completedAt);
  return Number.isFinite(start) && Number.isFinite(now) && now >= start && now < Date.parse(expiryFromCompletion(completedAt));
}
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c] ?? c));
}
export function buildReport(input: ReportInput): string {
  if (!input.project.trim() || !input.operator.trim() || !input.purpose.trim()) {
    throw new Error("Informe projeto, operador e finalidade.");
  }
  const safe = (s: string) => escapeHtml(s.trim() || "Não informado");
  const rows: [string,string][] = [
    ["Projeto",input.project],["Contratante",input.client],["Operador / autor",input.operator],
    ["Local",input.location],["Data do voo",input.flightDate],["Equipamento",input.equipment],
    ["Sistema de coordenadas",input.crs],["Fotografias",input.photos],["GSD",input.gsd]
  ];
  const products = [...new Set(input.products)].filter(p => (PRODUCTS as readonly string[]).includes(p));
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório de mapeamento</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:15px/1.55 Arial,sans-serif;color:#152b3a;max-width:800px;margin:30px auto;padding:18px}header{border-bottom:4px solid #0e7490;padding-bottom:15px}h1{font-size:27px}h2{font-size:19px;margin-top:24px}table{width:100%;border-collapse:collapse}td,th{padding:9px;border-bottom:1px solid #cbd5e1;text-align:left;overflow-wrap:anywhere}th{width:38%;background:#f1f5f9}.note{border-left:4px solid #0e7490;padding:12px;background:#f1f5f9}p{white-space:pre-wrap;overflow-wrap:anywhere}@media print{body{margin:0;padding:0}tr{break-inside:avoid}h2{break-after:avoid}}</style></head><body><header><strong>MBA GeoMap | Ferramenta de geração de documentos</strong><h1>Relatório descritivo de mapeamento</h1><p>'+safe(input.project)+'</p></header><p class="note">Rascunho gerado a partir de informações declaradas pelo operador. Não constitui certificação, laudo de acurácia nem responsabilidade técnica do GeoMap. Revisar antes de entregar.</p><h2>1. Identificação</h2><table>'+rows.map(([k,v])=>'<tr><th scope="row">'+escapeHtml(k)+'</th><td>'+safe(v)+'</td></tr>').join("")+'</table><h2>2. Finalidade</h2><p>'+safe(input.purpose)+'</p><h2>3. Metodologia</h2><p>'+safe(input.methodology)+'</p><h2>4. Produtos declarados pelo operador</h2><ul>'+ (products.length?products.map(p=>'<li>'+escapeHtml(p)+'</li>').join(""):'<li>Nenhum produto declarado.</li>')+'</ul><h2>5. Qualidade e limitações</h2><p>Acurácia horizontal e vertical absoluta: não verificada neste gerador. GSD não equivale à acurácia. Nenhuma classificação PEC-PCD é atribuída automaticamente.</p><p>'+safe(input.limitations)+'</p><h2>6. Guarda e responsabilidade</h2><p>O operador deve verificar, baixar e guardar os arquivos conforme suas obrigações. O GeoMap não substitui o profissional habilitado ou o acervo obrigatório.</p><p>Autor / responsável pela revisão: '+safe(input.operator)+'</p></body></html>';
}
