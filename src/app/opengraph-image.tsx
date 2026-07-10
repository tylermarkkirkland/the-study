import { ImageResponse } from "next/og";

// Social share card for The Study. Rendered on-brand (dark theme + the OS's
// traffic-light window controls) rather than from a screenshot, so it stays
// crisp and needs no binary asset. 1200x630 — the standard OG/Twitter size.

export const alt = "The Study — a desk you can sit down at";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          backgroundColor: "#0b0b0d",
          backgroundImage:
            "linear-gradient(135deg, #16161a 0%, #0b0b0d 55%, #060608 100%)",
          color: "#f5f5f7",
          fontFamily: "sans-serif",
        }}
      >
        {/* Window traffic lights — the signature of the OS chrome inside. */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 22, height: 22, borderRadius: 22, backgroundColor: "#ff5f57" }} />
          <div style={{ width: 22, height: 22, borderRadius: 22, backgroundColor: "#febc2e" }} />
          <div style={{ width: 22, height: 22, borderRadius: 22, backgroundColor: "#28c840" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 132, fontWeight: 700, letterSpacing: -3 }}>
            The Study
          </div>
          <div style={{ display: "flex", marginTop: 12, fontSize: 40, color: "#a1a1aa" }}>
            A little desktop world you can sit down at.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 40,
              width: 132,
              height: 6,
              borderRadius: 6,
              backgroundColor: "#0a84ff",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 30,
            color: "#a1a1aa",
          }}
        >
          <div style={{ display: "flex" }}>Tyler Kirkland · portfolio</div>
          <div style={{ display: "flex", color: "#6e6e73" }}>Best on desktop</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
