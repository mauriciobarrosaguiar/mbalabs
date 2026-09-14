import { PrivateElshadayDashboard } from "../PrivateElshadayDashboard";
import { RecentGalleryAlbums } from "../RecentGalleryAlbums";

export const dynamic = "force-dynamic";

export default async function ElshadayManagementHomePage() {
  return (
    <>
      <PrivateElshadayDashboard />
      <RecentGalleryAlbums />
    </>
  );
}
