import { getProfileOptionsForAppSlug } from "./app-registry";
import { requireLavaGestorSettingsAccess } from "./lavagestor-permissions";
import { getSupabaseServer } from "./supabase";

type Row = Record<string, unknown>;

export const LAVA_USUARIO_STATUS = [
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" }
];

export async function getLavaGestorUsuariosData() {
  const { current, perfil } = await requireLavaGestorSettingsAccess("/lavagestor/usuarios");
  const client = (await getSupabaseServer()) as any;
  const empresaId = current.empresaId;
  if (!empresaId) return { current, perfil, usuarios: [], funcionarios: [], profiles: [], error: "Selecione uma empresa." };

  const appResult = await client.from("core_apps").select("id,slug").eq("slug", "lavagestor").maybeSingle();
  const appId = appResult.data?.id ? String(appResult.data.id) : "";
  const [usuarios, permissoes, funcionarios] = await Promise.all([
    client.from("core_usuarios").select("id,nome,email,telefone,tipo,tipo_global,status,created_at").eq("empresa_id", empresaId).order("nome"),
    appId
      ? client.from("core_usuario_app_permissoes").select("usuario_id,perfil_app,status").eq("empresa_id", empresaId).eq("app_id", appId)
      : Promise.resolve({ data: [], error: null }),
    client.from("lava_funcionarios").select("id,nome,ativo,core_usuario_id").eq("empresa_id", empresaId).order("nome")
  ]);
  const permissionMap = new Map(((permissoes.data ?? []) as Row[]).map((row) => [String(row.usuario_id), row]));
  const funcionarioMap = new Map(((funcionarios.data ?? []) as Row[]).filter((row) => row.core_usuario_id).map((row) => [String(row.core_usuario_id), row]));

  return {
    current,
    perfil,
    appId,
    profiles: getProfileOptionsForAppSlug("lavagestor").filter((option) => !["admin_master", "super_admin"].includes(option.value)),
    usuarios: ((usuarios.data ?? []) as Row[]).map((row): Row => {
      const permission = permissionMap.get(String(row.id));
      const funcionario = funcionarioMap.get(String(row.id));
      return {
        ...row,
        perfil_app: permission?.perfil_app ?? row.tipo_global ?? row.tipo ?? "usuario",
        permissao_status: permission?.status ?? "sem_permissao",
        funcionario_id: funcionario?.id ?? "",
        funcionario: funcionario?.nome ?? ""
      };
    }),
    funcionarios: (funcionarios.data ?? []) as Row[],
    error: appResult.error?.message ?? usuarios.error?.message ?? permissoes.error?.message ?? funcionarios.error?.message ?? null
  };
}
