// Simulated demonstration data for the MBA GeoMap prototype. Nothing here comes from a real backend.

export type ProjectStatus =
  | "Disponível"
  | "Processando"
  | "Enviando arquivos"
  | "Aguardando processamento"
  | "Falhou"
  | "Arquivos expirados";

export interface Project {
  id: string;
  name: string;
  client: string;
  property: string;
  city: string;
  uf: string;
  date: string;
  drone: string;
  areaHa: number;
  photos: number;
  products: string[];
  status: ProjectStatus;
  daysLeft: number | null;
  progress: number;
  purpose: string;
  lat: number;
  lng: number;
  gsd: number;
  variant: number;
}

export const projects: Project[] = [
  { id: "fazenda-boa-vista", name: "Fazenda Boa Vista — Talhões 1 a 6", client: "Agropecuária Boa Vista Ltda.", property: "Fazenda Boa Vista", city: "Rio Verde", uf: "GO", date: "2026-11-24", drone: "DJI Mavic 3 Enterprise", areaHa: 412.6, photos: 1842, products: ["Ortomosaico", "MDT", "MDS", "Curvas", "VARI"], status: "Disponível", daysLeft: 5, progress: 100, purpose: "Agricultura de precisão", lat: 0.42, lng: 0.46, gsd: 3.1, variant: 1 },
  { id: "loteamento-jardim-sul", name: "Loteamento Jardim Sul", client: "Construtora Horizonte S.A.", property: "Gleba 14-B", city: "Uberlândia", uf: "MG", date: "2026-11-26", drone: "DJI Phantom 4 RTK", areaHa: 38.2, photos: 964, products: ["Ortomosaico", "MDT", "Curvas", "Nuvem"], status: "Processando", daysLeft: null, progress: 62, purpose: "Topografia / loteamento", lat: 0.55, lng: 0.58, gsd: 2.2, variant: 2 },
  { id: "pedreira-santa-rita", name: "Pedreira Santa Rita — Volumetria", client: "Mineração Santa Rita", property: "Cava Norte", city: "Itabira", uf: "MG", date: "2026-11-22", drone: "DJI Matrice 350 RTK", areaHa: 64.9, photos: 2310, products: ["Ortomosaico", "MDS", "Nuvem", "Modelo 3D"], status: "Disponível", daysLeft: 2, progress: 100, purpose: "Volumetria de pilhas", lat: 0.6, lng: 0.66, gsd: 1.8, variant: 3 },
  { id: "rodovia-go-174", name: "Duplicação GO-174 — Trecho 3", client: "Consórcio Via Centro", property: "Faixa de domínio", city: "Jataí", uf: "GO", date: "2026-11-27", drone: "DJI Mavic 3 Enterprise", areaHa: 121.4, photos: 1488, products: ["Ortomosaico", "MDT", "Curvas"], status: "Enviando arquivos", daysLeft: null, progress: 34, purpose: "Projeto rodoviário", lat: 0.45, lng: 0.4, gsd: 2.7, variant: 4 },
  { id: "sitio-recanto", name: "Sítio Recanto — APP e Reserva", client: "Marcos A. Pereira", property: "Sítio Recanto", city: "Lavras", uf: "MG", date: "2026-11-20", drone: "DJI Mini 4 Pro", areaHa: 22.8, photos: 412, products: ["Ortomosaico", "MDS"], status: "Disponível", daysLeft: 6, progress: 100, purpose: "Regularização ambiental (CAR)", lat: 0.68, lng: 0.6, gsd: 2.9, variant: 5 },
  { id: "usina-solar-norte", name: "Usina Solar Norte — Inspeção", client: "Energia Limpa do Cerrado", property: "UFV Norte", city: "Pirapora", uf: "MG", date: "2026-11-27", drone: "DJI Matrice 350 RTK", areaHa: 88.0, photos: 1210, products: ["Ortomosaico", "MDS", "Modelo 3D"], status: "Aguardando processamento", daysLeft: null, progress: 0, purpose: "Inspeção de ativos", lat: 0.5, lng: 0.7, gsd: 2.0, variant: 6 },
  { id: "cana-sao-jose", name: "Usina São José — Falhas de plantio", client: "Grupo São José Bioenergia", property: "Bloco 22", city: "Ribeirão Preto", uf: "SP", date: "2026-11-18", drone: "DJI Mavic 3 Multispectral", areaHa: 286.3, photos: 3120, products: ["Ortomosaico", "ExG", "GLI"], status: "Falhou", daysLeft: null, progress: 41, purpose: "Agricultura de precisão", lat: 0.78, lng: 0.62, gsd: 3.4, variant: 7 },
  { id: "condominio-vale", name: "Condomínio Vale das Águas", client: "Vale Empreendimentos", property: "Área 3", city: "Goiânia", uf: "GO", date: "2026-11-10", drone: "DJI Phantom 4 RTK", areaHa: 54.1, photos: 880, products: ["Ortomosaico", "MDT", "Curvas"], status: "Arquivos expirados", daysLeft: 0, progress: 100, purpose: "Levantamento planialtimétrico", lat: 0.52, lng: 0.48, gsd: 2.4, variant: 8 },
];

export const getProject = (id: string) => projects.find((p) => p.id === id);

export const photogrammetryStages = [
  "Validação das imagens",
  "Alinhamento",
  "Reconstrução espacial",
  "Nuvem de pontos",
  "Modelos de elevação",
  "Ortomosaico",
  "Validação",
  "Disponibilização dos arquivos",
];

export interface Job {
  projectId: string;
  status: string;
  stage: number;
  progress: number;
  start: string;
  elapsed: string;
  eta: string;
  server: string;
  images: number;
}

export const jobs: Job[] = [
  { projectId: "loteamento-jardim-sul", status: "Processando", stage: 4, progress: 62, start: "28/11 08:12", elapsed: "3h 41min", eta: "≈ 1h 50min", server: "nodeodm-gpu-01", images: 964 },
  { projectId: "rodovia-go-174", status: "Enviando arquivos", stage: 0, progress: 34, start: "28/11 10:58", elapsed: "52min", eta: "envio: ≈ 40min", server: "—", images: 1488 },
  { projectId: "usina-solar-norte", status: "Preparando servidor", stage: 0, progress: 6, start: "28/11 11:40", elapsed: "11min", eta: "≈ 4h 20min", server: "nodeodm-cpu-03 (sob demanda)", images: 1210 },
  { projectId: "cana-sao-jose", status: "Falhou", stage: 2, progress: 41, start: "27/11 19:05", elapsed: "2h 18min", eta: "—", server: "nodeodm-gpu-02", images: 3120 },
];

export const jobEvents = [
  { t: "11:49", level: "info", msg: "Jardim Sul: geração do MDS iniciada (resolução 4,4 cm/px)" },
  { t: "11:40", level: "info", msg: "Usina Solar Norte: provisionando instância c6i.8xlarge" },
  { t: "11:22", level: "success", msg: "Jardim Sul: nuvem densa concluída — 48,2 milhões de pontos" },
  { t: "10:58", level: "info", msg: "GO-174: envio retomável iniciado (1.488 fotos, 14,1 GB)" },
  { t: "09:37", level: "success", msg: "Jardim Sul: alinhamento concluído — 961/964 imagens calibradas" },
  { t: "21:23", level: "error", msg: "São José: falha na reconstrução — sobreposição insuficiente no bloco NE" },
];

export const equipment = [
  { name: "DJI Mavic 3 Enterprise", type: "Multirrotor", sensor: "4/3 CMOS 20 MP — obturador mecânico", serial: "1581F5FHD23", status: "Operacional", hours: 182, batteries: 6 },
  { name: "DJI Phantom 4 RTK", type: "Multirrotor RTK", sensor: "1\" CMOS 20 MP — FC6310R", serial: "0AXDE8K00203", status: "Operacional", hours: 421, batteries: 8 },
  { name: "DJI Matrice 350 RTK", type: "Plataforma industrial", sensor: "Zenmuse P1 — 45 MP full-frame", serial: "1ZNBJ7R00C1", status: "Em manutenção", hours: 96, batteries: 4 },
  { name: "DJI Mini 4 Pro", type: "Multirrotor compacto", sensor: "1/1.3\" CMOS 48 MP", serial: "1581F6Q8D2", status: "Operacional", hours: 58, batteries: 3 },
  { name: "DJI Mavic 3 Multispectral", type: "Multirrotor agrícola", sensor: "RGB 20 MP + 4 bandas 5 MP", serial: "1581F7M3A11", status: "Inativo", hours: 233, batteries: 5 },
];

export const servers = [
  { name: "nodeodm-gpu-01", kind: "GPU fixo", cpu: 87, ram: 74, ramTotal: 128, jobs: 1, cost: "R$ 6,40/h", status: "Ocupado" },
  { name: "nodeodm-gpu-02", kind: "GPU fixo", cpu: 4, ram: 9, ramTotal: 128, jobs: 0, cost: "R$ 6,40/h", status: "Ocioso" },
  { name: "nodeodm-cpu-03", kind: "CPU sob demanda", cpu: 22, ram: 31, ramTotal: 64, jobs: 1, cost: "R$ 3,10/h", status: "Inicializando" },
  { name: "nodeodm-cpu-04", kind: "CPU sob demanda", cpu: 0, ram: 0, ramTotal: 64, jobs: 0, cost: "R$ 3,10/h", status: "Desligado" },
];

export const expiringFiles = [
  { project: "Pedreira Santa Rita — Volumetria", file: "pacote_completo.zip", size: "18,4 GB", hours: 41 },
  { project: "Pedreira Santa Rita — Volumetria", file: "nuvem_densa.laz", size: "6,2 GB", hours: 41 },
  { project: "Fazenda Boa Vista — Talhões 1 a 6", file: "ortomosaico.tif", size: "9,8 GB", hours: 118 },
  { project: "Fazenda Boa Vista — Talhões 1 a 6", file: "mdt.tif", size: "2,1 GB", hours: 118 },
  { project: "Sítio Recanto — APP e Reserva", file: "ortomosaico.tif", size: "1,4 GB", hours: 142 },
];

export const notifications = [
  { t: "há 8 min", kind: "info", title: "MDS em geração", body: "Loteamento Jardim Sul chegou à etapa 5 de 8." },
  { t: "há 1 h", kind: "warning", title: "Arquivos expiram em 41 h", body: "Pedreira Santa Rita: baixe o pacote completo antes da exclusão." },
  { t: "há 3 h", kind: "success", title: "Processamento concluído", body: "Sítio Recanto — ortomosaico e MDS disponíveis." },
  { t: "ontem", kind: "error", title: "Processamento falhou", body: "Usina São José: sobreposição insuficiente no bloco NE." },
];

export const usageSeries = [
  { d: "22/11", horas: 6.2, gb: 41 },
  { d: "23/11", horas: 3.1, gb: 38 },
  { d: "24/11", horas: 9.8, gb: 62 },
  { d: "25/11", horas: 7.4, gb: 71 },
  { d: "26/11", horas: 11.2, gb: 88 },
  { d: "27/11", horas: 8.6, gb: 94 },
  { d: "28/11", horas: 5.3, gb: 97 },
];

export function seeded(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}