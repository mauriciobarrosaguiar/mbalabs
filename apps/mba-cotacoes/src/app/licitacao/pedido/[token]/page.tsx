import { PublicOrderPage } from "@/components/public/vendor-pages";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BiddingPublicOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <PublicOrderPage token={token} moduleType="bidding" />;
}
