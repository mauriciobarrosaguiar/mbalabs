import {state,createSupabaseAdminClient} from './dronegestor-planning-fixture.mjs';
export {state,createSupabaseAdminClient,getSessionProfile} from './dronegestor-planning-fixture.mjs';
export class CloudError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export async function cloudContext(){return {user_id:'rt-A',owner_type:'empresa',owner_id:'company-A',can_manage:true};}
export const cloudDb=createSupabaseAdminClient;
export function safeCloudName(value){return value;}
function forbidden(){state.externalCalls++;throw Error('Unexpected cloud side effect');}
export const cloudEvent=forbidden,cloudScope=forbidden,decryptCloud=forbidden,driveCall=forbidden,driveOperationFolder=forbidden,encryptCloud=forbidden,googleAccessToken=forbidden;
