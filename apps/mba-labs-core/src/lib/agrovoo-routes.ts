// Public identity and legacy storage/API identity are deliberately separate.
export const AGROVOO_ROOT="/apps/agrovoo";
export const LEGACY_AGROVOO_ROOT="/apps/dronegestor";
export function canonicalAgroVooPath(path:string){
 if(path!==LEGACY_AGROVOO_ROOT&&!path.startsWith(LEGACY_AGROVOO_ROOT+"/")&&!path.startsWith(LEGACY_AGROVOO_ROOT+"?"))return path;
 const suffix=path.slice(LEGACY_AGROVOO_ROOT.length);
 if(suffix==="/agrovoo"||suffix.startsWith("/agrovoo?"))return AGROVOO_ROOT+"/painel"+suffix.slice("/agrovoo".length);
 if(suffix.startsWith("/agrovoo/"))return AGROVOO_ROOT+suffix.slice("/agrovoo".length);
 return AGROVOO_ROOT+suffix;
}
export function internalAgroVooPath(path:string){
 if(path!==AGROVOO_ROOT&&!path.startsWith(AGROVOO_ROOT+"/"))return path;
 const suffix=path.slice(AGROVOO_ROOT.length);
 if(suffix==="/painel")return LEGACY_AGROVOO_ROOT+"/agrovoo";
 if(/^\/(piloto|financeiro|os)(\/|$)/.test(suffix)||/^\/cadastros\//.test(suffix))return LEGACY_AGROVOO_ROOT+"/agrovoo"+suffix;
 return LEGACY_AGROVOO_ROOT+suffix;
}
