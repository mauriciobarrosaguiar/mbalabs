import { ImageResponse } from "next/og";
import { createElement } from "react";

export const runtime = "edge";

export async function GET() {
  const content = createElement(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, #020617 0%, #0f172a 52%, #0e7490 100%)",
        color: "white",
        borderRadius: "102px",
        fontFamily: "Arial, sans-serif"
      }
    },
    createElement(
      "div",
      {
        style: {
          width: "378px",
          height: "378px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: "14px solid rgba(103, 232, 249, 0.75)",
          borderRadius: "90px",
          background: "rgba(15, 23, 42, 0.76)",
          boxShadow: "0 54px 145px rgba(6, 182, 212, 0.28)"
        }
      },
      createElement("div", { style: { fontSize: "130px", fontWeight: 900, letterSpacing: "-8px" } }, "MBA"),
      createElement("div", { style: { marginTop: "-10px", fontSize: "68px", fontWeight: 800, color: "#67e8f9" } }, "Labs")
    )
  );

  return new ImageResponse(content, {
    width: 512,
    height: 512,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" }
  });
}
