import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          background: "#176b5b",
          color: "white",
          borderRadius: 96,
          fontFamily: "Arial"
        }}
      >
        <div style={{ fontSize: 170, lineHeight: 1 }}>🎓</div>
        <div style={{ fontSize: 62, fontWeight: 900, marginTop: 18 }}>MBA</div>
        <div style={{ fontSize: 42, fontWeight: 700 }}>ESCOLA</div>
      </div>
    ),
    size
  );
}
