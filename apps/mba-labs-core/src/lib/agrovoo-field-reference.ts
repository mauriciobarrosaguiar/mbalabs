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
