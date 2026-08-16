import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getSessionProfile } from "@/lib/core-data";
import { canManageDroneGestor } from "@/lib/dronegestor-role";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";
import {
  droneOsErrorResponse,
  requireDroneOsAccess,
  scopeDroneOsQuery,
} from "@/lib/dronegestor-os-access";

export const dynamic = "force-dynamic";

const FINALIZED_ACTION = "operacao_finalizada";
const DOC_ACTION = "documento_operacao_v1";
const SARPAS_ACTION = "sarpas_operacao_v1";
const MAP_ACTION = "mapa_voo_evidencia";

type Context = { userId: string; empresaId: string | null; canManage: boolean };
function normalize(v: string) {
  return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll(" ", "_");
}
function text(v: unknown, max = 300) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function obj(v: unknown): Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : {};
}
function num(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function fmt(v: unknown, d = 1) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(num(v));
}
function dt(v: unknown) {
  const raw = String(v || "");
  if (!raw) return "Não informado";
  const d = new Date(raw);
  return Number.isNaN(d.getTime())
    ? raw
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
async function getContext() {
  const s = await getSessionProfile();
  if (!s.user || !s.profile)
    return {
      current: null,
      response: NextResponse.json({ ok: false, error: "Autenticação necessária." }, { status: 401 }),
    };
  const t = normalize(s.profile.tipo || "");
  const master = ["super_admin", "admin_master"].includes(t);
  const allowed = (s.appsLiberados ?? []).some((a) => a.slug === "dronegestor" && a.canAccess);
  if (!master && !allowed)
    return {
      current: null,
      response: NextResponse.json(
        { ok: false, error: "Acesso ao DroneGestor não liberado." },
        { status: 403 },
      ),
    };
  return {
    current: {
      userId: s.profile.id,
      empresaId: s.profile.empresa_id,
      canManage: canManageDroneGestor({ tipo: s.profile.tipo, isAdminMaster: master, permissoes: s.permissoes }),
    } as Context,
    response: null,
  };
}
async function rows(admin: any, c: Context, action: string, limit = 500) {
  let q = admin
    .from("core_logs")
    .select("id,usuario_id,detalhes,created_at")
    .eq("app_slug", "dronegestor")
    .eq("acao", action)
    .order("created_at", { ascending: false })
    .limit(limit);
  q = scopeDroneOsQuery(q, c);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
function osIdFromState(state: Record<string, any>) {
  return text(obj(state.mission).ordemServicoId, 120);
}

export async function GET(request: NextRequest) {
  try {
    const access = await getContext();
    if (access.response) return access.response;
    const c = access.current!;
    const osId = text(request.nextUrl.searchParams.get("osId"), 120);
    if (!osId) return NextResponse.json({ ok: false, error: "Informe a OS." }, { status: 400 });

    const admin = createSupabaseAdminClient() as any;
    const osAccess = await requireDroneOsAccess(admin, c, osId);
    const osData = osAccess.data;

    const [finalizedRows, docRows, sarpasRows, mapRows] = await Promise.all([
      rows(admin, c, FINALIZED_ACTION),
      rows(admin, c, DOC_ACTION),
      rows(admin, c, SARPAS_ACTION, 300),
      rows(admin, c, MAP_ACTION, 300),
    ]);
    const finalized = finalizedRows.find((r: any) => {
      const d = obj(r.detalhes);
      const s = obj(d.summary);
      const st = obj(d.state);
      return text(s.ordemServicoId, 120) === osId || osIdFromState(st) === osId;
    });
    if (!finalized)
      return NextResponse.json(
        { ok: false, error: "Os dados finais do campo ainda não foram sincronizados para gerar o pacote." },
        { status: 409 },
      );

    const details = obj(finalized.detalhes);
    const state = obj(details.state);
    const summary = obj(details.summary);
    const mission = obj(state.mission);
    const docs = docRows
      .map((r: any) => obj(r.detalhes))
      .filter((d: any) => text(d.ordemServicoId, 120) === osId);
    const sarpas = obj(
      sarpasRows.find((r: any) => text(r?.detalhes?.ordemServicoId, 120) === osId)?.detalhes,
    );
    const mapOk = Boolean(
      mapRows.find((r: any) => text(r?.detalhes?.ordemServicoId, 120) === osId),
    );
    const bytes = await buildPdf({
      osId,
      osData,
      state,
      summary,
      mission,
      docs,
      sarpas,
      mapOk,
      finalizedAt: text(details.finalizedAt, 60) || String(finalized.created_at || ""),
    });
    const safe = (text(osData.numero, 80) || text(mission.ordemServicoNumero, 80) || osId).replace(
      /[^a-zA-Z0-9_-]+/g,
      "-",
    );
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="DroneGestor-Pacote-${safe}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const accessError = droneOsErrorResponse(error);
    if (accessError)
      return NextResponse.json({ ok: false, error: accessError.message }, { status: accessError.status });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Falha ao gerar o pacote da operação." },
      { status: 500 },
    );
  }
}

async function buildPdf(data: {
  osId: string;
  osData: Record<string, any>;
  state: Record<string, any>;
  summary: Record<string, any>;
  mission: Record<string, any>;
  docs: Record<string, any>[];
  sarpas: Record<string, any>;
  mapOk: boolean;
  finalizedAt: string;
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const w = new PdfWriter(pdf, font, bold);
  const m = data.mission;
  const s = data.summary;
  const state = data.state;
  const tanks = Array.isArray(state.tankRecords) ? state.tankRecords : [];
  const products = Array.isArray(m.produtos) ? m.produtos : Array.isArray(s.produtos) ? s.produtos : [];
  const occ = Array.isArray(state.occurrences) ? state.occurrences : [];
  const area = num(m.area) || num(s.areaHa);
  const real = num(state.progressHa) || num(s.areaConcluidaHa);
  const realVolume =
    tanks.reduce((sum: number, item: any) => sum + Math.max(0, num(item?.volumeL)), 0) ||
    num(s.totalCaldaRealL);
  const weather = obj(state.weather);
  const calibration = obj(state.calibration);
  const checklist = obj(state.checklist);
  const pilot =
    text(s.piloto, 180) ||
    text(data.osData.pilotoResponsavelNome || data.osData.pilotoNome, 180) ||
    "Não identificado";
  const sarpasStatus = text(data.sarpas.status, 60) || text(m.sarpasSituacao, 60);
  const sarpasNumber = text(data.sarpas.numero, 120) || text(m.sarpasNumero, 120);

  w.title("DroneGestor Agro - Pacote da Operação");
  w.note("Prontuário interno da aplicação. Não substitui o relatório mensal oficial do MAPA.");
  w.section("Identificação");
  w.row(
    "Situação",
    data.osData.status === "concluida"
      ? "OS encerrada"
      : data.osData.status === "campo_concluido"
        ? "Campo concluído - regularização"
        : "Operação em andamento",
  );
  w.row("OS", text(data.osData.numero, 80) || text(m.ordemServicoNumero, 80) || data.osId);
  w.row("Piloto", pilot);
  w.row(
    "Drone / ANAC",
    `${text(m.drone, 120) || text(s.drone, 120) || "Não informado"} / ${text(m.registroAnac, 120) || text(s.registroAnac, 120) || "Não informado"}`,
  );
  w.row("Cliente", text(m.clienteNome, 180) || text(s.clienteNome, 180) || "Não informado");
  w.row(
    "Fazenda / talhão",
    `${text(m.fazendaNome, 180) || text(s.fazendaNome, 180) || "Não informado"} / ${text(m.talhaoNome, 180) || text(s.talhaoNome, 180) || "Não informado"}`,
  );
  w.row(
    "Localidade",
    `${text(m.municipio, 120) || text(s.municipio, 120) || "Não informado"} / ${text(m.uf, 2) || text(s.uf, 2) || "-"}`,
  );
  w.row(
    "Responsável da propriedade",
    text(data.osData.responsavelPropriedade, 180) || text(m.responsavelPropriedade, 180) || "Não informado",
  );
  w.row(
    "Endereço / referência",
    text(data.osData.enderecoPropriedade, 240) || text(m.enderecoPropriedade, 240) || "Não informado",
  );

  w.section("Resultado");
  w.row("Atividade", text(m.tipoAtividade, 100) || text(s.tipoAtividade, 100) || "Pulverização");
  w.row(
    "Cultura / alvo",
    `${text(m.cultura, 120) || text(s.cultura, 120) || "Não informado"} / ${text(m.alvo, 160) || text(s.alvo, 160) || "Não informado"}`,
  );
  w.row("Área planejada", `${fmt(area, 2)} ha`);
  w.row("Área realizada", `${fmt(real, 2)} ha`);
  w.row("Cargas", String(tanks.length));
  w.row("Volume real", `${fmt(realVolume, 1)} L`);
  w.row("Início", dt(state.startedAt || s.iniciadaEm));
  w.row("Término", dt(state.endedAt || state.concluidaNoDispositivoEm || s.finalizadaEm || data.finalizedAt));
  w.row("Ocorrências", String(occ.length || num(s.totalOcorrencias)));

  w.section("Parâmetros e produtos");
  w.row("Volume", `${fmt(m.volume || s.volumeLHa, 1)} L/ha`);
  w.row(
    "Faixa / velocidade / altura",
    `${fmt(m.faixa || s.faixaM, 1)} m / ${fmt(m.velocidadeKmh || s.velocidadeKmh, 1)} km/h / ${fmt(m.alturaM || s.alturaM, 1)} m`,
  );
  w.row("Bico / atomizador", text(m.pontaModelo, 160) || text(s.pontaModelo, 160) || "Não informado");
  if (products.length)
    products.forEach((p: any, i: number) =>
      w.text(`${i + 1}. ${text(p?.nome, 180) || "Produto"} - ${fmt(p?.dose, 2)} ${text(p?.unidade, 40)}`),
    );
  else w.text("Nenhum produto registrado.");

  w.section("Segurança e rastreabilidade");
  w.row(
    "Calibração",
    Object.keys(calibration).length && Object.values(calibration).every(Boolean) ? "Concluída" : "Pendente",
  );
  w.row(
    "Checklist pré-voo",
    Object.keys(checklist).length && Object.values(checklist).every(Boolean) ? "Concluído" : "Pendente",
  );
  w.row("Análise de risco", state.riskAccepted === true ? "Confirmada" : "Pendente");
  w.row(
    "GPS",
    Number.isFinite(Number(weather.latitude)) && Number.isFinite(Number(weather.longitude))
      ? `${Number(weather.latitude).toFixed(5)}, ${Number(weather.longitude).toFixed(5)}`
      : "Não registrado",
  );
  w.row("Clima medido em", dt(m.climaCampoMedidoEm || s.climaCampoMedidoEm));
  w.row(
    "Vento / direção",
    `${fmt(m.ventoCampoKmh ?? s.climaCampo?.ventoKmh, 1)} km/h / ${text(m.direcaoVentoCampo, 60) || text(s.climaCampo?.direcaoVento, 60) || "Não informado"}`,
  );
  w.row(
    "Temperatura / umidade",
    `${fmt(m.temperaturaCampo ?? s.climaCampo?.temperaturaC, 1)} °C / ${fmt(m.umidadeCampo ?? s.climaCampo?.umidadePct, 0)}%`,
  );

  w.section("Regularização e documentos");
  w.row(
    "SARPAS",
    sarpasStatus === "autorizado"
      ? `Autorizado - ${sarpasNumber || "referência não informada"}`
      : sarpasStatus || "Pendente",
  );
  w.row("Mapa / evidência", data.mapOk ? "Vinculado" : "Pendente");
  w.row("Documentos vinculados", String(data.docs.length));
  w.row("Fechamento", text(data.osData.fechamentoStatus, 80) || "Não conferido");
  if (Array.isArray(data.osData.pendenciasFechamento) && data.osData.pendenciasFechamento.length) {
    w.subtitle("Pendências");
    data.osData.pendenciasFechamento.forEach((p: any) => w.text(`- ${String(p)}`));
  }
  w.subtitle("Arquivos e evidências");
  if (data.docs.length)
    data.docs.forEach((d: any, i: number) =>
      w.text(`${i + 1}. ${text(d.nome, 180) || text(d.tipo, 100) || "Documento"}`),
    );
  else w.text("Nenhum documento vinculado.");
  if (data.mapOk) w.text("- Mapa/evidência do voo vinculado.");
  if (sarpasStatus)
    w.text(`- Registro SARPAS: ${sarpasStatus}${sarpasNumber ? ` - ${sarpasNumber}` : ""}.`);

  w.section("Registro");
  w.row("Aplicação finalizada/sincronizada", dt(data.finalizedAt));
  w.row("Pacote gerado em", dt(new Date().toISOString()));
  w.note("Documento gerado automaticamente pelo DroneGestor Agro com base nos dados salvos no servidor.");
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

class PdfWriter {
  private page!: PDFPage;
  private y = 0;
  private readonly width = 595.28;
  private readonly height = 841.89;
  private readonly margin = 48;
  constructor(private pdf: PDFDocument, private font: PDFFont, private bold: PDFFont) {
    this.newPage();
  }
  private newPage() {
    this.page = this.pdf.addPage([this.width, this.height]);
    this.y = this.height - 54;
    this.page.drawText("DroneGestor Agro", {
      x: this.margin,
      y: this.height - 28,
      size: 9,
      font: this.bold,
      color: rgb(0.03, 0.38, 0.27),
    });
    this.page.drawLine({
      start: { x: this.margin, y: this.height - 36 },
      end: { x: this.width - this.margin, y: this.height - 36 },
      thickness: 0.6,
      color: rgb(0.82, 0.89, 0.85),
    });
  }
  private ensure(space = 34) {
    if (this.y - space < this.margin) this.newPage();
  }
  title(v: string) {
    this.ensure(48);
    this.page.drawText(v, {
      x: this.margin,
      y: this.y,
      size: 20,
      font: this.bold,
      color: rgb(0.03, 0.25, 0.19),
    });
    this.y -= 30;
  }
  section(v: string) {
    this.ensure(42);
    this.y -= 5;
    this.page.drawText(v, {
      x: this.margin,
      y: this.y,
      size: 13,
      font: this.bold,
      color: rgb(0.06, 0.22, 0.18),
    });
    this.y -= 22;
  }
  subtitle(v: string) {
    this.ensure(30);
    this.page.drawText(v, {
      x: this.margin,
      y: this.y,
      size: 10.5,
      font: this.bold,
      color: rgb(0.12, 0.25, 0.21),
    });
    this.y -= 17;
  }
  row(label: string, value: string) {
    this.ensure(30);
    this.page.drawText(`${label}:`, {
      x: this.margin,
      y: this.y,
      size: 9.5,
      font: this.bold,
      color: rgb(0.3, 0.35, 0.33),
    });
    this.y = this.wrap(
      String(value || "Não informado"),
      this.margin + 128,
      this.y,
      10,
      this.width - this.margin - (this.margin + 128),
    );
    this.y -= 5;
  }
  text(v: string) {
    this.ensure(24);
    this.y = this.wrap(v, this.margin, this.y, 10, this.width - this.margin * 2);
    this.y -= 4;
  }
  note(v: string) {
    this.ensure(24);
    this.y = this.wrap(v, this.margin, this.y, 8.5, this.width - this.margin * 2, rgb(0.42, 0.48, 0.46));
    this.y -= 4;
  }
  private wrap(
    v: string,
    x: number,
    y: number,
    size: number,
    maxWidth: number,
    color = rgb(0.13, 0.17, 0.16),
  ) {
    const words = v.replace(/[\r\n]+/g, " ").split(/\s+/).filter(Boolean);
    let line = "";
    let cursor = y;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (this.font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) {
        this.page.drawText(line, { x, y: cursor, size, font: this.font, color });
        cursor -= 14;
      }
      line = word;
    }
    if (line) {
      this.page.drawText(line, { x, y: cursor, size, font: this.font, color });
      cursor -= 14;
    }
    return cursor;
  }
}
