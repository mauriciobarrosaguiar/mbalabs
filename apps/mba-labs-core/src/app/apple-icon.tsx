import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #020617 0%, #0f172a 52%, #0e7490 100%)",
          color: "white",
          borderRadius: "36px",
          fontFamily: "Arial, sans-serif"
        }}
      >
        <div
          style={{
            width: "132px",
            height: "132px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "5px solid rgba(103, 232, 249, 0.78)",
            borderRadius: "30px",
            background: "rgba(15, 23, 42, 0.78)"
          }}
        >
          <div style={{ fontSize: "45px", fontWeight: 900, letterSpacing: "-3px" }}>MBA</div>
          <div style={{ marginTop: "-4px", fontSize: "23px", fontWeight: 800, color: "#67e8f9" }}>Labs</div>
        </div>
      </div>
    ),
    size
  );
}
