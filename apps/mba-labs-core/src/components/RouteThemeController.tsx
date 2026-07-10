"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SYSTEM_ROUTE_PREFIXES = [
  "/apps",
  "/cotacoes",
  "/lavagestor",
  "/bikecomanda",
  "/lexgestor",
  "/portal-associativo"
];

function isMbaPlatformRoute(pathname: string) {
  if (pathname === "/") return false;

  return !SYSTEM_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function applyRouteTheme(pathname: string) {
  const root = document.documentElement;

  if (isMbaPlatformRoute(pathname)) {
    root.dataset.mbaPlatform = "true";
    root.dataset.mbaTheme = "dark";
    root.style.colorScheme = "dark";
    return;
  }

  delete root.dataset.mbaPlatform;
  delete root.dataset.mbaTheme;
  root.style.removeProperty("color-scheme");
}

export function RouteThemeController() {
  const pathname = usePathname();

  useEffect(() => {
    applyRouteTheme(pathname);
  }, [pathname]);

  return null;
}
