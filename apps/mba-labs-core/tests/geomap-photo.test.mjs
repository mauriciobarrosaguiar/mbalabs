import test from "node:test";
import assert from "node:assert/strict";
import {inspectPhotoHeader} from "../src/app/apps/geomap/photo-preflight.ts";
function fixture(le=true){
 const x=new Uint8Array(128);const d=new DataView(x.buffer);x.set(le?[73,73]:[77,77]);
 const w=(p,v)=>d.setUint16(p,v,le),l=(p,v)=>d.setUint32(p,v,le);
 w(2,42);l(4,8);w(8,1);w(10,34853);w(12,4);l(14,1);l(18,26);
 w(26,4);
 const entry=(p,tag,type,n,val)=>{w(p,tag);w(p+2,type);l(p+4,n);if(type===2)x[p+8]=val;else l(p+8,val)};
 entry(28,1,2,2,83);entry(40,2,5,3,80);entry(52,3,2,2,87);entry(64,4,5,3,104);
 for(let i=0;i<6;i++){l(80+i*8,[10,30,0,48,15,0][i]);l(84+i*8,1);}
 return x;
}
test("GPS southern and western in both byte orders",()=>{for(const le of [true,false])assert.deepEqual(inspectPhotoHeader(fixture(le)).gps,{lat:-10.5,lon:-48.25});});
test("JPEG EXIF and unsupported/truncated input",()=>{const t=fixture();const length=t.length+8;const j=Uint8Array.from([255,216,255,225,length>>8,length&255,69,120,105,102,0,0,...t,255,217]);assert.equal(inspectPhotoHeader(j).format,"JPEG");assert.deepEqual(inspectPhotoHeader(j).gps,{lat:-10.5,lon:-48.25});assert.equal(inspectPhotoHeader(new Uint8Array([1,2,3])).format,"unsupported");assert.equal(inspectPhotoHeader(t.slice(0,15)).gps,null);});
