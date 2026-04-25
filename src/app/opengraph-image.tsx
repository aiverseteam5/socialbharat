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
        background: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
        color: "#FFFFFF",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontSize: 88,
          letterSpacing: "-0.03em",
          marginBottom: 24,
        }}
      >
        <span style={{ fontWeight: 300 }}>Social</span>
        <span style={{ fontWeight: 700 }}>Bharat</span>
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
          color: "#FFFFFF",
          fontWeight: 600,
          opacity: 0.85,
        }}
      >
        socialbharat.tynkai.com
      </div>
    </div>,
    { ...size },
  );
}
