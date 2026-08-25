import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireAppAccess } from "@/lib/core-data";

const SCHOOL_URL = "https://ihcfhuxxjllmqypzuzce.supabase.co";

export const dynamic = "force-dynamic";

export async function POST() {
  const current = await requireAppAccess("mba-escola", "/mba-escola");
  const email = current.authUser.email?.trim().toLowerCase();

  if (!email) {
    return response({ error: "Seu usuário da MBA Labs não possui e-mail válido para o MBA Escola." }, 400);
  }

  const adminKey =
    process.env.MBA_ESCOLA_SUPABASE_SECRET_KEY ||
    process.env.MBA_ESCOLA_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ESCOLA_SERVICE_ROLE_KEY;

  if (!adminKey) {
    return response(
      {
        code: "MBA_ESCOLA_SSO_NOT_CONFIGURED",
        error: "O acesso único do MBA Escola ainda não possui a credencial técnica configurada no servidor."
      },
      503
    );
  }

  const admin = createClient(SCHOOL_URL, adminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  let schoolUser = await findUserByEmail(admin, email);

  // O Admin Master da MBA Labs é também o proprietário global do MBA Escola.
  // Se ainda não existir no projeto escolar, o vínculo é criado automaticamente.
  if (!schoolUser && current.isAdminMaster) {
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        nome: current.usuario.nome,
        origem: "mba-labs-sso",
        core_user_id: current.authUser.id
      }
    });

    if (created.error || !created.data.user) {
      return response({ error: created.error?.message || "Não foi possível criar o vínculo do Admin MBA." }, 500);
    }

    schoolUser = created.data.user;
  }

  if (!schoolUser) {
    return response(
      {
        code: "MBA_ESCOLA_USER_NOT_LINKED",
        error: "Seu acesso existe na MBA Labs, mas ainda não foi vinculado a uma escola. A administração da escola deve liberar seu perfil."
      },
      403
    );
  }

  if (current.isAdminMaster) {
    const { data: owner, error: ownerError } = await admin
      .from("escola_super_admins")
      .select("user_id")
      .eq("user_id", schoolUser.id)
      .maybeSingle();

    if (ownerError) {
      return response({ error: ownerError.message }, 500);
    }

    if (!owner) {
      const { error: insertOwnerError } = await admin.from("escola_super_admins").insert({
        user_id: schoolUser.id,
        nome: current.usuario.nome,
        email,
        ativo: true
      });

      if (insertOwnerError) {
        return response({ error: insertOwnerError.message }, 500);
      }
    }
  } else {
    const [{ data: profile, error: profileError }, { data: owner, error: ownerError }] = await Promise.all([
      admin.from("escola_perfis").select("id,ativo").eq("id", schoolUser.id).maybeSingle(),
      admin.from("escola_super_admins").select("user_id,ativo").eq("user_id", schoolUser.id).maybeSingle()
    ]);

    if (profileError || ownerError) {
      return response({ error: profileError?.message || ownerError?.message || "Falha ao validar o vínculo escolar." }, 500);
    }

    if ((!profile || profile.ativo !== true) && (!owner || owner.ativo !== true)) {
      return response(
        {
          code: "MBA_ESCOLA_PROFILE_INACTIVE",
          error: "Seu usuário da MBA Labs ainda não possui um perfil escolar ativo."
        },
        403
      );
    }
  }

  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: "https://www.mbalabs.com.br/mba-escola"
    }
  });

  if (generated.error) {
    return response({ error: generated.error.message }, 500);
  }

  const tokenHash = generated.data.properties?.hashed_token;
  if (!tokenHash) {
    return response({ error: "Não foi possível gerar a sessão automática do MBA Escola." }, 500);
  }

  return response({ tokenHash }, 200);
}

async function findUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const perPage = 1000;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const found = data.users.find((user) => user.email?.trim().toLowerCase() === email);
    if (found) return found;
    if (data.users.length < perPage) return null;
  }

  return null;
}

function response(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0"
    }
  });
}
