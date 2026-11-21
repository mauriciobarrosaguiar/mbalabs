import { requireAppAccess } from '@/lib/core-data';
import { CalculationCenter } from './CalculationCenter';
export const dynamic = 'force-dynamic';
export default async function Page() {
  await requireAppAccess('dronegestor', '/apps/dronegestor/ferramentas');
  return <CalculationCenter />;
}
