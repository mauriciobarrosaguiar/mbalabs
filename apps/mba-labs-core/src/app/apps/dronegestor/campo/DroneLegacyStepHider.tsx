"use client";

import { useEffect } from "react";

function hideLegacySteps(){
  if(typeof document==="undefined")return;
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  let node=walker.nextNode();
  while(node){
    const text=node.nodeValue?.trim()||"";
    if(/^Etapa\s+\d+\s+de\s+8$/i.test(text)||/^Fase\s+\d+\s+de\s+6(?:\s+•.*)?$/i.test(text)){
      const row=node.parentElement?.parentElement;
      if(row&&row.tagName==="DIV"&&row.querySelectorAll("span").length<=3){
        row.style.display="none";
        row.setAttribute("aria-hidden","true");
      }
    }
    node=walker.nextNode();
  }
}

export function DroneLegacyStepHider(){
  useEffect(()=>{
    hideLegacySteps();
    const observer=new MutationObserver(hideLegacySteps);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
