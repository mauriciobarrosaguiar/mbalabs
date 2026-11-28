// Bounded, local preflight: reads metadata only; never certifies image integrity.
export type PhotoMeta={format:"JPEG"|"TIFF"|"unsupported"; gps:{lat:number;lon:number}|null; camera:string|null; warning:string|null};
export const HEADER_LIMIT=1024*1024;
function tiff(bytes:Uint8Array):Omit<PhotoMeta,"format">{
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const le=bytes[0]===73&&bytes[1]===73;
 const be=bytes[0]===77&&bytes[1]===77;
 if(bytes.length<8||(!le&&!be)||dv.getUint16(2,le)!==42)throw Error("TIFF não suportado");
 const u16=(p:number)=>dv.getUint16(p,le),u32=(p:number)=>dv.getUint32(p,le);
 const read=(offset:number)=>{
  const count=u16(offset);if(count>512||offset+2+count*12>bytes.length)throw Error("IFD fora do limite");
  const entries=new Map<number,{type:number;count:number;pos:number}>();
  for(let i=0;i<count;i++){
   const p=offset+2+i*12, type=u16(p+2),n=u32(p+4), unit=({1:1,2:1,3:2,4:4,5:8} as Record<number,number>)[type];
   if(!unit||n>100000||n===0)continue;
   const size=unit*n,pos=size<=4?p+8:u32(p+8);
   if(pos+size>bytes.length)continue;
   entries.set(u16(p),{type,count:n,pos});
  }return entries;
 };
 const root=read(u32(4));
 function ascii(entry:{type:number;count:number;pos:number}|undefined){
  return entry?.type===2?new TextDecoder("ascii").decode(bytes.subarray(entry.pos,entry.pos+Math.min(entry.count,160))).replace(/\0.*$/,"").trim():null;
 }
 const camera=ascii(root.get(272))||ascii(root.get(271));
 const pointer=root.get(34853);
 let gps:null|{lat:number;lon:number}=null;
 if(pointer?.type===4&&pointer.count===1){
  const g=read(u32(pointer.pos));
  function coord(tag:number,refTag:number,limit:number,positive:string,negative:string){
   const e=g.get(tag),ref=ascii(g.get(refTag));
   if(e?.type!==5||e.count!==3||!ref||![positive,negative].includes(ref))return null;
   const nums=Array.from({length:3},(_,i)=>{const p=e.pos+i*8,den=u32(p+4);return den?u32(p)/den:NaN});
   if(nums.some(x=>!Number.isFinite(x)||x<0)||nums[1]>=60||nums[2]>=60)return null;
   const value=nums[0]+nums[1]/60+nums[2]/3600;
   return value<=limit?value*(ref===negative?-1:1):null;
  }
  const lat=coord(2,1,90,"N","S"),lon=coord(4,3,180,"E","W");
  if(lat!==null&&lon!==null)gps={lat,lon};
 }
 return {gps,camera,warning:gps?null:"GPS não localizado no cabeçalho lido"};
}
export function inspectPhotoHeader(bytes:Uint8Array):PhotoMeta{
 let format:PhotoMeta["format"]="unsupported";
 try{
  if(bytes[0]===255&&bytes[1]===216){
   format="JPEG";let p=2;
   while(p+4<=bytes.length){
    if(bytes[p++]!==255)throw Error("Marcador JPEG inválido");
    while(bytes[p]===255)p++;
    const marker=bytes[p++];
    if(marker===218||marker===217)break;
    if(marker===1||(marker>=208&&marker<=215))continue;
    if(p+2>bytes.length)break;
    const n=bytes[p]*256+bytes[p+1];if(n<2||p+n>bytes.length)break;
    const start=p+2;
    if(marker===225&&n>=8&&bytes[start]===69&&bytes[start+1]===120&&bytes[start+2]===105&&bytes[start+3]===102&&bytes[start+4]===0&&bytes[start+5]===0){
     return {format,...tiff(bytes.subarray(start+6,p+n))};
    }p+=n;
   }
   return {format,gps:null,camera:null,warning:"EXIF/GPS não localizado no cabeçalho lido"};
  }
  if((bytes[0]===73&&bytes[1]===73)||(bytes[0]===77&&bytes[1]===77)){
   format="TIFF";return {format,...tiff(bytes)};
  }
  return {format,gps:null,camera:null,warning:"Assinatura de imagem não reconhecida"};
 }catch{return {format,gps:null,camera:null,warning:"Metadados incompletos, inválidos ou fora do limite de leitura"}}
}
