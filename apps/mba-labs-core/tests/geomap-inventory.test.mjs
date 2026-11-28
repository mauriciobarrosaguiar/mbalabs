import test from "node:test";import assert from "node:assert/strict";
import {parseInventory} from "../src/app/apps/geomap/r2-inventory-parse.ts";
const xml=(truncated,count,contents="")=>"<ListBucketResult><IsTruncated>"+truncated+"</IsTruncated><KeyCount>"+count+"</KeyCount>"+contents+"</ListBucketResult>";
test("empty bucket and partial inventory",()=>{assert.equal(parseInventory(xml(false,0)).bytes,0);const r=parseInventory(xml(true,2,"<Contents><Size>100</Size></Contents><Contents><Size>200</Size></Contents>"));assert.equal(r.bytes,300);assert.equal(r.complete,false);});
test("invalid inventories fail closed",()=>{for(const x of ["<Error/>",xml(false,2),xml(false,1,"<Contents><Size>-1</Size></Contents>")])assert.throws(()=>parseInventory(x));});
