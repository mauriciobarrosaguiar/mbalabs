"use client";
import NextLink from "next/link";
import { usePathname,useRouter } from "next/navigation";
import { forwardRef, type ComponentPropsWithoutRef } from "react";
const base="/apps/geomap";
type LinkProps=Omit<ComponentPropsWithoutRef<"a">,"href"> & {to:string;params?:{id?:string}};
function href(to:string,params?:{id?:string}) {return base+(to==="/"?"":to.replace("$id",encodeURIComponent(params?.id??"")));}
export const Link=forwardRef<HTMLAnchorElement,LinkProps>(function Link({to,params,...props},ref){return <NextLink ref={ref} href={href(to,params)} {...props}/>});
export function useRouterState<T>({select}:{select:(s:{location:{pathname:string}})=>T}):T {const pathname=usePathname();return select({location:{pathname:pathname.slice(base.length)||"/"}});}
export function useNavigate(){const router=useRouter();return ({to,params}:{to:string;params?:{id?:string}})=>router.push(href(to,params));}
