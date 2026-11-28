import { z } from "zod";
const str=(max:number)=>z.string().trim().max(max);
export const projectInputSchema=z.object({
 name:str(180).min(1),client:str(180),property:str(180),city:str(120).min(1),uf:z.enum(["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]),
 operator:str(180),rt:str(180),date:z.union([z.literal(""),z.iso.date()]),purpose:str(500),drone:str(120)
}).strict();
export type ProjectInput=z.infer<typeof projectInputSchema>;
export type RealProject=ProjectInput & {id:string;created_at:string;status:"draft"};
export type ProjectList={ready:boolean;projects:RealProject[]};
export const emptyProject:ProjectInput={name:"",client:"",property:"",city:"",uf:"TO",operator:"",rt:"",date:"",purpose:"",drone:"DJI Mini 2"};
