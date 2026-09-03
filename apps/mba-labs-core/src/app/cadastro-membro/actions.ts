"use server";

import { redirect } from "next/navigation";
import { requireElshadayContext } from "@/lib/elshaday";

export async function registerPublicElshadayMember(_formData: FormData) {
  await requireElshadayContext("/elshaday");
  redirect("/elshaday");
}
