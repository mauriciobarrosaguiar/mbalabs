import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/modules/cotacoes/lib/auth/session";
import { createSupabaseAdminClient } from "@/modules/cotacoes/lib/supabase/server";

export async function GET() {
  try {
    const auth = await getCurrentAuthContext();

    if (!auth.isAuthenticated || !auth.profile) {
      return NextResponse.json({ error: "Sessão não autenticada." }, { status: 401 });
    }

    if (!auth.isActive) {
      return NextResponse.json({ error: "Usuário inativo." }, { status: 403 });
    }

    const tenantId = auth.tenantAccess?.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "Empresa não identificada na sessão." }, { status: 403 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id,core_empresa_id,nome_fantasia,razao_social,cnpj")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError) throw tenantError;
    if (!tenant) {
      return NextResponse.json({ error: "Empresa do MBA Cotações não encontrada." }, { status: 404 });
    }

    let companyName = tenant.nome_fantasia || tenant.razao_social || "";
    let cnpj = tenant.cnpj || "";

    if (tenant.core_empresa_id) {
      const { data: coreCompany, error: coreError } = await supabase
        .from("core_empresas")
        .select("nome,nome_fantasia,cnpj")
        .eq("id", tenant.core_empresa_id)
        .maybeSingle();

      if (coreError) throw coreError;
      if (coreCompany) {
        companyName = coreCompany.nome_fantasia || coreCompany.nome || companyName;
        cnpj = coreCompany.cnpj || cnpj;
      }
    }

    const formattedCnpj = formatCnpj(cnpj);
    if (!formattedCnpj) {
      return NextResponse.json(
        { error: "O CNPJ da empresa não está cadastrado corretamente no MBA Labs." },
        { status: 409 },
      );
    }

    return NextResponse.json({
      tenantId,
      companyName,
      cnpj: String(cnpj).replace(/\D/g, ""),
      formattedCnpj,
    });
  } catch (error) {
    console.error("[MBA Cotações] Erro ao carregar empresa da cotação.", error);
    return NextResponse.json(
      { error: "Não foi possível carregar os dados da empresa." },
      { status: 500 },
    );
  }
}

function formatCnpj(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 14) return "";

  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5",
  );
}
