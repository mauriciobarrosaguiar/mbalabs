"use client";
import { createLucideIcon } from "lucide-react";
/** Agricultural multirotor silhouette used throughout the AgroDoc navigation. */
export const AgroDocDroneIcon = createLucideIcon("AgroDocDrone", [
  ["path", { d: "M9 10h6l2 3-3 2h-4l-3-2 2-3Z", key: "body" }],
  [
    "path",
    {
      d: "m9 11-5-3m11 3 5-3M4 5v5m16-5v5M1 5h6m10 0h6M8 14l-2 5m10-5 2 5M9 19H5m10 0h4M12 15v3",
      key: "arms",
    },
  ],
  ["path", { d: "M2 8h4m12 0h4M11 11h2", key: "detail" }],
]);
