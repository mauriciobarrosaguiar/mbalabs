export type Inventory={ok:boolean;bytes:number;objects:number;complete:boolean;message:string};
export function parseInventory(xml:string):Inventory{
 if(xml.length>2_000_000||!/<ListBucketResult(?:\s[^>]*)?>/.test(xml)||!/<\/ListBucketResult>\s*$/.test(xml))throw Error("Invalid inventory");
 const truncated=xml.match(/<IsTruncated>(true|false)<\/IsTruncated>/);
 const count=xml.match(/<KeyCount>(\d+)<\/KeyCount>/);
 if(!truncated||!count)throw Error("Invalid inventory metadata");
 const objects=[...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)];
 if(objects.length!==Number(count[1])||objects.length>1000)throw Error("Invalid count");
 let bytes=0;
 for(const item of objects){const match=item[1].match(/<Size>(\d+)<\/Size>/);if(!match)throw Error("Size missing");bytes+=Number(match[1]);if(!Number.isSafeInteger(bytes))throw Error("Invalid bytes");}
 return {ok:true,bytes,objects:objects.length,complete:truncated[1]==="false",message:truncated[1]==="false"?"Inventário atual dos objetos concluído.":"Mais de 1.000 objetos; valor parcial, não representa o total."};
}
