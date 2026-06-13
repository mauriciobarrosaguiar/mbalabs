import { redirect } from "next/navigation";

export default function NovoAppPage() {
  redirect("/admin/apps");
}
