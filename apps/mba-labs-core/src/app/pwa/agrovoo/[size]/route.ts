import {ImageResponse} from "next/og";
import {createElement} from "react";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{size:string}>}){
 const {size:raw}=await params;
 if(raw!=="192"&&raw!=="512")return new Response("Not found",{status:404});
 const size=Number(raw);
 return new ImageResponse(createElement("div",{style:{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#123e38",color:"#bef264",fontSize:size*.29,fontWeight:800}}, "AV"),{width:size,height:size,headers:{"Cache-Control":"public, max-age=86400"}});
}
