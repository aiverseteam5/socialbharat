import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SocialBharat — India's AI Social Media Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "80px",
        background: "linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)",
        color: "#FFFFFF",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: 88,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          marginBottom: 24,
        }}
      >
        <span>Social</span>
        <span style={{ color: "#FF6B35" }}>Bharat</span>
        <span style={{ marginLeft: 16 }}>🇮🇳</span>
      </div>
      <div
        style={{
          fontSize: 36,
          color: "#CBD5E1",
          lineHeight: 1.3,
          maxWidth: 900,
        }}
      >
        India&apos;s AI Social Media Platform. WhatsApp Business, Instagram, and
        Facebook — with content in Hindi.
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          bottom: 60,
          left: 80,
          fontSize: 24,
          color: "#FF6B35",
          fontWeight: 600,
        }}
      >
        socialbharat.tynkai.com
      </div>
    </div>,
    { ...size },
  );
}
