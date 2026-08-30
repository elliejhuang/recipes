import { ImageResponse } from "next/og";

// Generated rather than checked in as a file, so the mark and the palette stay
// in one place instead of drifting apart.
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
          background: "#8f3a24",
          color: "#fcfcfd",
          fontSize: 320,
          fontFamily: "Georgia, serif",
          fontWeight: 600,
        }}
      >
        R
      </div>
    ),
    size,
  );
}
