"use server";
import { revalidatePath } from "next/cache";
import { insertGeoMapProject } from "./project-store";
export async function createGeoMapProject(input:unknown){
 const result=await insertGeoMapProject(input);
 if(result.ok)revalidatePath("/apps/geomap","layout");
 return result;
}
