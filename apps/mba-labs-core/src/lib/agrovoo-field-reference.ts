/** Stull (2011), doi:10.1175/JAMC-D-11-0143.1, sea-level pressure approximation.
 * Conservative input range for this display. Not a preflight or agronomic gate.
 */
export function estimateFieldDeltaT(temperature:unknown,humidity:unknown){
 if(typeof temperature!=="number"||typeof humidity!=="number"||!Number.isFinite(temperature)||!Number.isFinite(humidity)||temperature<0||temperature>50||humidity<5||humidity>99)return null;
 const t=temperature,rh=humidity;
 const wet=t*Math.atan(0.151977*Math.sqrt(rh+8.313659))+Math.atan(t+rh)-Math.atan(rh-1.676331)+0.00391838*Math.pow(rh,1.5)*Math.atan(0.023101*rh)-4.686035;
 if(!Number.isFinite(wet)||wet>t)return null;
 return {wetBulbC:wet,deltaC:t-wet};
}

/** Additional descriptive data only: absent values stay absent on legacy operations. */
export function normalizeDropletMicrons(value:unknown):number|null{
 if(typeof value!=="number"||!Number.isFinite(value)||value<=0||value>10000)return null;
 return Math.round(value*100)/100||null;
}
export function normalizeAssistantName(value:unknown):string{
 return typeof value==="string"?value.replace(/[\u0000-\u001f\u007f]/g," ").trim().slice(0,120):"";
}
