import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@mba-labs/shared/supabase/server";

type SetupPayload = {
  nome?: string;
  email?: string;
  password?: string;
  empresa?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SetupPayload;
    const nome = payload.nome?.trim();
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password;
    const empresaNome = payload.empresa?.trim() || "MBA Labs";

    if (!nome || !email || !password || password.length < 8) {
      return NextResponse.json(
        { error: "Informe nome, email e uma senha com pelo menos 8 caracteres." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient() as any;
    const { count, error: countError } = await supabase
      .from("core_usuarios")
      .select("id", { count: "exact", head: true })
      .in("tipo", ["super_admin", "admin_master"]);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Ja existe um Admin Master cadastrado." },
        { status: 409 }
      );
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome
      }
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? "Nao foi possivel criar usuario no Auth." },
        { status: 500 }
      );
    }

    const { data: categoria, error: categoriaError } = await supabase
      .from("core_empresa_categorias")
      .upsert(
        {
          nome: "Outros",
          slug: "outros",
          descricao: "Categoria geral para empresas nao classificadas.",
          status: "ativa"
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();

    if (categoriaError || !categoria) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: categoriaError?.message ?? "Nao foi possivel criar categoria inicial." },
        { status: 500 }
      );
    }

    const { data: empresa, error: empresaError } = await supabase
      .from("core_empresas")
      .insert({
        categoria_id: categoria.id,
        nome: empresaNome,
        nome_fantasia: empresaNome,
        razao_social: empresaNome,
        email,
        responsavel: nome,
        status: "ativa"
      })
      .select("id")
      .single();

    if (empresaError || !empresa) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: empresaError?.message ?? "Nao foi possivel criar empresa." },
        { status: 500 }
      );
    }

    const { error: profileError } = await supabase.from("core_usuarios").insert({
      auth_user_id: authData.user.id,
      empresa_id: empresa.id,
      nome,
      email,
      tipo: "super_admin",
      tipo_global: "super_admin",
      status: "ativo"
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro ao criar Admin Master."
      },
      { status: 500 }
    );
  }
}
