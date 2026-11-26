// Queue acknowledgements must preserve entries added or replaced while a request was in flight.
export function readFinalizationQueue<T extends {operationId:string}>(raw:string|null):T[]|null{
 try{
  if(raw===null)return [];
  const rows=JSON.parse(raw);
  if(!Array.isArray(rows)||rows.some(row=>!row||typeof row.operationId!=="string"||!row.operationId||typeof row.state!=="object"||!row.state||Array.isArray(row.state)))return null;
  return rows as T[];
 }catch{return null;}
}
export function acknowledgeFinalization<T extends {operationId:string}>(latest:T[],sent:T):T[]{
 return latest.filter(row=>row.operationId!==sent.operationId||JSON.stringify(row)!==JSON.stringify(sent));
}
