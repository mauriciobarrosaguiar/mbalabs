// Treinamento didático, sem dependência das APIs, GPS ou estado operacional.
export const TRAINING_AREA=20;
export const TRAINING_RATE=10;
export const TRAINING_TANK=40;
export const TRAINING_PHASES=["Ordem de serviço","Planejamento","Documentação","Segurança no local","Equipamento e calibração","Preparo da calda","Aplicação","Pós-operação"] as const;
export type TrainingState={phase:number;checks:number[];loads:{ha:number;liters:number}[];paused:boolean;partialAt:number;partialReason:string;occurrences:string[];map:string;status:"preparacao"|"campo"|"suspensa"|"entregue"|"conferida"};
export const initialTraining=():TrainingState=>({phase:1,checks:[],loads:[],paused:false,partialAt:0,partialReason:"",occurrences:[],map:"",status:"preparacao"});
const round=(v:number)=>Math.round(v*1000)/1000;
export function trainingTotals(s:TrainingState){const area=round(s.loads.reduce((a,b)=>a+b.ha,0)),liters=round(s.loads.reduce((a,b)=>a+b.liters,0));return {area,liters,remaining:round(TRAINING_AREA-area),loads:s.loads.length};}
export type TrainingAction={type:"next"}|{type:"load";ha:number;liters:number}|{type:"pause"}|{type:"partial";reason:string}|{type:"resume"}|{type:"occurrence";note:string}|{type:"map";name:string}|{type:"deliver"}|{type:"review"}|{type:"reset"}|{type:"check";index:number};
export function trainingStep(s:TrainingState,a:TrainingAction):TrainingState{
 const t=trainingTotals(s);
 switch(a.type){
 case "reset":return initialTraining();
 case "check":return s.status==="preparacao"&&s.phase<=6&&a.index===s.phase?{...s,checks:s.checks.includes(a.index)?s.checks.filter(v=>v!==a.index):[...s.checks,a.index]}:s;
 case "next":if(s.status!=="preparacao"||s.phase>=7||!s.checks.includes(s.phase))return s;return {...s,phase:s.phase+1,status:s.phase===6?"campo":"preparacao"};
 case "load":if(s.status!=="campo"||s.paused||!Number.isFinite(a.ha)||!Number.isFinite(a.liters)||a.ha<=0||a.liters<=0||a.ha>t.remaining||a.liters>TRAINING_TANK||round(a.ha)===0||round(a.liters)===0)return s;return {...s,loads:[...s.loads,{ha:round(a.ha),liters:round(a.liters)}]};
 case "pause":return s.status==="campo"?{...s,paused:!s.paused}:s;
 case "partial":return s.status==="campo"&&t.area>s.partialAt&&t.remaining>0&&a.reason.trim().length>=5?{...s,status:"suspensa",paused:true,partialAt:t.area,partialReason:a.reason.trim().slice(0,300)}:s;
 case "resume":return s.status==="suspensa"?{...s,phase:4,status:"preparacao",paused:false,checks:s.checks.filter(v=>v<4)}:s;
 case "occurrence":return s.status==="campo"&&a.note.trim()?{...s,occurrences:[...s.occurrences,a.note.trim().slice(0,300)]}:s;
 case "map":return s.status==="campo"&&/\.(?:jpe?g|png|webp|kml|kmz)$/i.test(a.name)?{...s,map:a.name.slice(0,180)}:s;
 case "deliver":return s.status==="campo"&&t.remaining===0&&Boolean(s.map)?{...s,phase:8,status:"entregue",paused:false}:s;
 case "review":return s.status==="entregue"?{...s,status:"conferida"}:s;
 }
}
