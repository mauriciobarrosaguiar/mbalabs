import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext, isTenantSuspended } from "@/modules/cotacoes/lib/auth/session";
import { getSessionProfile } from "@/lib/core-data";
import {
  connectTenantWhatsApp,
  disconnectTenantWhatsApp,
  getTenantWhatsAppStatus,
} from "@/modules/cotacoes/lib/whatsapp/tenant-whatsapp";

export const dynamic = "force-dynamic";
// Render pode precisar inicializar a Evolution API após inatividade.
export const maxDuration = 180;
export const revalidate = 0;

async function tenantAccess() {
  const [auth, session] = await Promise.all([getCurrentAuthContext(), getSessionProfile()]);
  if (auth.isSuperAdmin) {
    return { error: NextResponse.json({ error: "O WhatsApp só pode ser conectado pelo administrador da própria farmácia." }, { status: 403 }) };
  }
  const entitled = (session.appsLiberados ?? [])
    .some((app) => (app.slug === "mba-cotacoes" || app.slug === "mbacotacoes") && app.canAccess);
  if (!entitled) {
    return { error: NextResponse.json({ error: "Empresa sem assinatura ativa do MBA Cotações." }, { status: 403 }) };
  }
  if (!auth.isAuthenticated || !auth.isActive || !auth.tenantAccess ||
      isTenantSuspended(auth.tenantAccess.tenantStatus)) {
    return { error: NextResponse.json({ error: "Você precisa selecionar uma empresa válida do MBA Cotações." }, { status: 403 }) };
  }
  return {
    tenantId: auth.tenantAccess.tenantId,
    canManage: auth.tenantAccess.role === "ADMIN_EMPRESA",
  };
}

export async function GET() {
  try {
    const auth = await tenantAccess();
    if (auth.error) return auth.error;
    return NextResponse.json({ ok: true, ...(await getTenantWhatsAppStatus(auth.tenantId!)) }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[Cotacoes WhatsApp] Falha ao consultar status", error);
    return NextResponse.json({ error: "Não foi possível consultar o status do WhatsApp." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await tenantAccess();
    if (auth.error) return auth.error;
    if (!auth.canManage) return NextResponse.json({ error: "Somente administradores da empresa podem conectar o WhatsApp." }, { status: 403 });
    const input = await request.json().catch(() => ({})) as { action?: string };
    if (input.action === "connect") return NextResponse.json({ ok: true, ...(await connectTenantWhatsApp(auth.tenantId!)) });
    if (input.action === "disconnect") return NextResponse.json(await disconnectTenantWhatsApp(auth.tenantId!));
    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error) {
    console.error("[Cotacoes WhatsApp] Falha ao conectar/desconectar", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível realizar a operação." }, { status: 502 });
  }
}
