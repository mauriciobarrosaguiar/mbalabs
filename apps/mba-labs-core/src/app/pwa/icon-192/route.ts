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
        borderRadius: "38px",
        fontFamily: "Arial, sans-serif"
      }
    },
    createElement(
      "div",
      {
        style: {
          width: "142px",
          height: "142px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          border: "5px solid rgba(103, 232, 249, 0.75)",
          borderRadius: "34px",
          background: "rgba(15, 23, 42, 0.76)",
          boxShadow: "0 20px 55px rgba(6, 182, 212, 0.28)"
        }
      },
      createElement("div", { style: { fontSize: "48px", fontWeight: 900, letterSpacing: "-3px" } }, "MBA"),
      createElement("div", { style: { marginTop: "-4px", fontSize: "25px", fontWeight: 800, color: "#67e8f9" } }, "Labs")
    )
  );

  return new ImageResponse(content, {
    width: 192,
    height: 192,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" }
  });
}
