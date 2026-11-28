import {z} from "zod";
export const products=[
 {id:"orto",name:"Ortomosaico",desc:"Imagem aérea georreferenciada.",format:"GeoTIFF",deps:[]},
 {id:"mdt",name:"MDT",desc:"Modelo do terreno com classificação do solo.",format:"GeoTIFF",deps:[]},
 {id:"mds",name:"MDS",desc:"Modelo da superfície, incluindo objetos.",format:"GeoTIFF",deps:[]},
 {id:"curvas",name:"Curvas de nível",desc:"Linhas de igual elevação, derivadas do MDT.",format:"GPKG / DXF",deps:["mdt"]},
 {id:"decliv",name:"Declividade",desc:"Inclinação estimada do terreno.",format:"GeoTIFF",deps:["mdt"]},
 {id:"hipso",name:"Hipsometria",desc:"Faixas de altitude do terreno.",format:"GeoTIFF",deps:["mdt"]},
 {id:"nuvem",name:"Nuvem de pontos",desc:"Reconstrução espacial.",format:"LAZ",deps:[]},
 {id:"3d",name:"Modelo 3D",desc:"Malha texturizada.",format:"OBJ",deps:["nuvem"]},
 {id:"rgb",name:"Índices RGB",desc:"VARI, ExG e GLI; não é NDVI.",format:"GeoTIFF",deps:["orto"]},
 {id:"rel-proc",name:"Relatório de processamento",desc:"Parâmetros e qualidade observada.",format:"PDF",deps:[]},
 {id:"rel-pers",name:"Relatório personalizado",desc:"Documento descritivo para revisão.",format:"PDF",deps:["rel-proc"]}
] as const;
const ids=products.map(p=>p.id);
export function dependencies(selected:string[]):string[]{
 const resolved=new Set<string>();
 function add(id:string){const p=products.find(p=>p.id===id);if(!p||resolved.has(id))return;resolved.add(id);for(const dep of p.deps)add(dep);}
 for(const id of selected)add(id);
 return ids.filter(id=>resolved.has(id));
}
export const photoSummarySchema=z.object({count:z.number().int().min(1).max(5000),bytes:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),gps:z.number().int().nonnegative(),unsupported:z.number().int().nonnegative(),duplicates:z.number().int().nonnegative()}).strict().superRefine((p,ctx)=>{if([p.gps,p.unsupported,p.duplicates].some(v=>v>p.count))ctx.addIssue({code:"custom",message:"Contagens inconsistentes"});});
export type PhotoSummary=z.infer<typeof photoSummarySchema>;
export const configSchema=z.object({quality:z.enum(["rapido","equilibrado","alta"]),crs:z.enum(["auto","EPSG:31982","EPSG:31983","EPSG:31981"]),resolutionCm:z.number().finite().min(1).max(100),contourM:z.number().finite().min(.1).max(100)}).strict();
export type ProcessingConfig=z.infer<typeof configSchema>;
export const defaultConfig:ProcessingConfig={quality:"equilibrado",crs:"auto",resolutionCm:5,contourM:1};
export const planSchema=z.object({projectId:z.string().uuid().nullable(),photos:photoSummarySchema,selected:z.array(z.string().refine(id=>ids.includes(id as typeof ids[number]))).min(1).max(ids.length),config:configSchema}).strict().superRefine((p,ctx)=>{if(p.photos.unsupported>0)ctx.addIssue({code:"custom",message:"Remova arquivos com formato não reconhecido."});});
export function makePlan(input:unknown){
 const p=planSchema.parse(input);
 return {schemaVersion:1,kind:"geomap-processing-plan",status:"draft",...p,requiredProducts:dependencies(p.selected),retentionHours:168,uploaded:false,submitted:false,accuracyVerified:false};
}
