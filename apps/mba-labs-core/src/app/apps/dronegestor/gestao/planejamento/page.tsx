import { redirect } from 'next/navigation';
import { getSessionProfile } from '@/lib/core-data';
import { canManageDroneGestor } from '@/lib/dronegestor-role';
import { DroneMissionPlanning } from './DroneMissionPlanning';
export default async function Page({searchParams}:{searchParams:Promise<{osId?:string}>}){
 const session=await getSessionProfile();
 if(!session.profile||session.profile.status!=='ativo'||!canManageDroneGestor({tipo:session.profile.tipo,permissoes:session.permissoes}))redirect('/apps/dronegestor/gestao');
 const {osId}=await searchParams;
 return <DroneMissionPlanning osId={osId||''}/>;
}
