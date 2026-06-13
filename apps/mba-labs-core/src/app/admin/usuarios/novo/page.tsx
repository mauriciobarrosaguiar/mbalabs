import { redirect } from "next/navigation";

export default function NovoUsuarioPage() {
  redirect("/admin/usuarios");
}
