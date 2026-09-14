"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import styles from "./RouteThemeController.module.css";

const SYSTEM_ROUTE_PREFIXES = [
  "/apps",
  "/cotacoes",
  "/cotacao",
  "/licitacao",
  "/lavagestor",
  "/bikecomanda",
  "/lexgestor",
  "/portal-associativo",
  "/mba-escola",
  "/elshaday",
  "/cadastro-membro"
];

function isMbaPlatformRoute(pathname: string, search = "") {
  if (pathname === "/") return false;
  const isElshadayAuthRoute =
    ["/login", "/recuperar-senha", "/alterar-senha"].includes(pathname) &&
    new URLSearchParams(search).get("app") === "elshaday";
  if (isElshadayAuthRoute) return false;

  return !SYSTEM_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function applyRouteTheme(pathname: string) {
  const root = document.documentElement;

  if (isMbaPlatformRoute(pathname, window.location.search)) {
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

  return <span aria-hidden="true" className={styles.themeMarker} />;
}
