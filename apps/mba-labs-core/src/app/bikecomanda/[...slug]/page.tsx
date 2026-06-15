import { notFound } from "next/navigation";
import { BikeComandaApp, resolveBikeSection } from "@/components/BikeComandaApp";
import { requireAppAccess } from "@/lib/core-data";

export const dynamic = "force-dynamic";

export default async function BikeComandaSectionPage({
  params
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const section = resolveBikeSection(slug[0]);

  if (!section || slug.length > 1) {
    notFound();
  }

  await requireAppAccess("bikecomanda", `/bikecomanda/${section.slug}`);
  return <BikeComandaApp activeSlug={section.slug} />;
}
