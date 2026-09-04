import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  getOptionalElshadayContext,
  hasElshadayRole
} from "@/lib/elshaday";
import {
  canAssignMemberFunction,
  memberFunction,
  memberFunctionRole
} from "@/lib/elshaday-member-functions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await getOptionalElshadayContext();

  if (!context) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  if (!hasElshadayRole(context.papel, ["admin", "pastor", "tesouraria", "secretaria", "lider"])) {
    return NextResponse.json({ error: "Perfil sem permissão para editar membros." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const membroId = String(body?.membroId ?? "").trim();
    const requestedCargo = String(body?.cargo ?? "").trim();

    if (!membroId) {
      return NextResponse.json({ error: "Membro não informado." }, { status: 400 });
    }

    const cargo = memberFunction(requestedCargo);
    if (!canAssignMemberFunction(context.papel, cargo.value)) {
      return NextResponse.json(
        { error: "Somente o Administrador pode atribuir funções com permissões elevadas." },
        { status: 403 }
      );
    }

    const { data: member, error: memberError } = await context.admin
      .from("igreja_membros")
      .select("id,user_id,nome,cargo")
      .eq("id", membroId)
      .eq("igreja_id", context.igreja.id)
      .maybeSingle();

    if (memberError || !member) {
      return NextResponse.json({ error: "Membro não pertence a esta igreja." }, { status: 404 });
    }

    const targetRole = memberFunctionRole(cargo.value);

    if (
      context.papel === "admin" &&
      member.user_id &&
      String(member.user_id) === String(context.current.authUser.id) &&
      targetRole !== "admin"
    ) {
      return NextResponse.json(
        { error: "Para evitar perda do acesso administrativo, você não pode reduzir o próprio perfil por esta ficha." },
        { status: 400 }
      );
    }

    const { error: cargoError } = await context.admin
      .from("igreja_membros")
      .update({
        cargo: cargo.value,
        updated_at: new Date().toISOString()
      })
      .eq("id", membroId)
      .eq("igreja_id", context.igreja.id);

    if (cargoError) throw cargoError;

    // Apenas o Administrador pode conceder ou alterar permissões elevadas.
    // Os demais perfis continuam podendo cadastrar/editar membros sem risco de elevação de acesso.
    if (context.papel === "admin" && member.user_id) {
      if (!context.igreja.empresa_id) {
        throw new Error("Igreja sem organização vinculada.");
      }

      const { data: app, error: appError } = await context.admin
        .from("core_apps")
        .select("id")
        .eq("slug", "elshaday")
        .maybeSingle();

      if (appError || !app?.id) {
        throw new Error("O app Elshaday não está configurado no MBA Labs.");
      }

      const { data: coreUser, error: coreUserError } = await context.admin
        .from("core_usuarios")
        .select("id,auth_user_id")
        .eq("empresa_id", context.igreja.empresa_id)
        .eq("auth_user_id", member.user_id)
        .maybeSingle();

      if (coreUserError) throw coreUserError;

      if (coreUser?.id) {
        const { error: permissionError } = await context.admin
          .from("core_usuario_app_permissoes")
          .upsert(
            {
              usuario_id: coreUser.id,
              empresa_id: context.igreja.empresa_id,
              app_id: app.id,
              perfil_app: targetRole,
              status: "ativo",
              updated_at: new Date().toISOString()
            },
            { onConflict: "usuario_id,app_id" }
          );

        if (permissionError) throw permissionError;
      }

      const { error: profileError } = await context.admin
        .from("igreja_perfis")
        .upsert(
          {
            igreja_id: context.igreja.id,
            user_id: member.user_id,
            papel: targetRole,
            ativo: true,
            updated_at: new Date().toISOString()
          },
          { onConflict: "igreja_id,user_id" }
        );

      if (profileError) throw profileError;
    }

    try {
      await context.admin.from("core_logs").insert({
        empresa_id: context.igreja.empresa_id,
        usuario_id: context.current.usuario.id,
        app_slug: "elshaday",
        acao: "elshaday cargo/perfil sincronizado",
        detalhes: {
          membro_id: membroId,
          cargo: cargo.value,
          papel: targetRole,
          permissoes_sincronizadas: context.papel === "admin" && Boolean(member.user_id)
        }
      });
    } catch {
      // Auditoria não deve impedir a atualização principal.
    }

    revalidatePath("/elshaday/membros");
    revalidatePath(`/elshaday/membros/${membroId}`);
    revalidatePath("/elshaday/acessos");

    return NextResponse.json({
      ok: true,
      cargo: cargo.value,
      role: targetRole,
      permissionsSynced: context.papel === "admin" && Boolean(member.user_id)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível atualizar o cargo." },
      { status: 500 }
    );
  }
}
