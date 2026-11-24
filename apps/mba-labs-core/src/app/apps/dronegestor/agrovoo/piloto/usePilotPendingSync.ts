"use client";
import {useEffect,useState} from "react";
import {pilotPendingSyncCount} from "@/lib/agrovoo-pilot-view";
export function usePilotPendingSync(owner:string){
 const [count,setCount]=useState<number|null>(null);
 useEffect(()=>{const update=()=>{try{setCount(pilotPendingSyncCount(window.localStorage,owner));}catch{setCount(null);}};update();const timer=window.setInterval(update,1500);window.addEventListener("storage",update);window.addEventListener("focus",update);return()=>{window.clearInterval(timer);window.removeEventListener("storage",update);window.removeEventListener("focus",update);};},[owner]);
 return count;
}
