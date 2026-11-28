"use server";
import {revalidatePath} from "next/cache";
import {savePlan} from "./plan-store";
export async function saveGeoMapPlan(input:unknown){
 const result=await savePlan(input);
 if(result.ok)revalidatePath("/apps/geomap","layout");
 return result;
}
