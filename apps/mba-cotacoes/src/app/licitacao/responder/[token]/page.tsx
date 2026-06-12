import { VendorResponsePage } from "@/components/public/vendor-pages";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BiddingPublicResponsePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <VendorResponsePage token={token} moduleType="bidding" />;
}
