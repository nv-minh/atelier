import { ImageResponse } from "next/og";
import { BRAND, MARK } from "@/lib/brand";
import { TOPICS } from "@/lib/topic-taxonomy";

// The card that renders when someone pastes a link to the site into Zalo,
// Messenger, Slack or X. Drawn here rather than committed as a PNG so it
// stays in step with the palette and the topic count.
//
// Deliberately no next/font: ImageResponse rasterises outside the browser and
// cannot read the CSS variables, so this uses satori's bundled face. That
// costs us Fraunces, and buys correct Vietnamese diacritics — a beautiful card
// reading "H?c ti?ng Anh" is worse than a plain one that reads correctly.
export const alt = "Atelier — studio học ngôn ngữ theo lịch nhắc lại";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The interval ladder, the same argument the landing page makes visually: the
// gap between reviews of a word you are remembering well keeps widening.
const RUNGS = [
  { top: 0, label: "10 phút" },
  { top: 34, label: "1 ngày" },
  { top: 84, label: "3 ngày" },
  { top: 154, label: "1 tuần" },
  { top: 250, label: "3 tuần" },
  { top: 380, label: "2 tháng" },
];

export default function OpengraphImage() {
  const u = 64 / MARK.artboard; // render the 64-unit mark artboard at 64px
  const { bowl, stem } = MARK;
  const innerRadius = bowl.outerRadius - bowl.stroke;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: BRAND.paper,
          fontFamily: "sans-serif",
        }}
      >
        {/* LEFT — wordmark, headline, colophon */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "68px 0 68px 76px",
            width: 810,
          }}
        >
          {/* Wordmark: the mark, then "Atelier" with the ember full stop that
              the nav uses as the logotype's tail. */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                position: "relative",
                display: "flex",
                width: 64,
                height: 64,
                background: BRAND.ink,
                borderRadius: 64 * (MARK.cornerRadius / MARK.artboard),
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: (bowl.cx - bowl.outerRadius) * u,
                  top: (bowl.cy - bowl.outerRadius) * u,
                  width: bowl.outerRadius * 2 * u,
                  height: bowl.outerRadius * 2 * u,
                  borderRadius: bowl.outerRadius * 2 * u,
                  background: BRAND.emberOnInk,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: stem.x * u,
                  top: stem.y * u,
                  width: stem.width * u,
                  height: stem.height * u,
                  borderRadius: stem.radius * u,
                  background: BRAND.emberOnInk,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: (bowl.cx - innerRadius) * u,
                  top: (bowl.cy - innerRadius) * u,
                  width: innerRadius * 2 * u,
                  height: innerRadius * 2 * u,
                  borderRadius: innerRadius * 2 * u,
                  background: BRAND.ink,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                marginLeft: 20,
                fontSize: 34,
                letterSpacing: "-0.01em",
                color: BRAND.ink,
              }}
            >
              {BRAND.name}
              <span style={{ color: BRAND.ember }}>.</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 82, color: BRAND.ink, lineHeight: 1.08 }}>
              Học tiếng Anh
            </div>
            <div style={{ display: "flex", fontSize: 82, color: BRAND.ember, lineHeight: 1.08 }}>
              và nhớ được lâu.
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 26,
                fontSize: 27,
                color: BRAND.soft,
                lineHeight: 1.4,
                maxWidth: 700,
              }}
            >
              Ôn đúng vào ngày bạn sắp quên một từ.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 21,
              fontFamily: "monospace",
              color: BRAND.soft,
              letterSpacing: "0.02em",
            }}
          >
            {`hơn 8.000 từ · A1–C1 · ${TOPICS.length} chủ đề · 7 chế độ học · miễn phí`}
          </div>
        </div>

        {/* RIGHT — the interval ladder */}
        <div style={{ display: "flex", position: "relative", width: 390, height: "100%" }}>
          <div
            style={{
              position: "absolute",
              left: 60,
              top: 110,
              width: 2,
              height: 410,
              background: BRAND.line,
            }}
          />
          {RUNGS.map((r) => (
            <div
              key={r.label}
              style={{
                position: "absolute",
                left: 46,
                top: 110 + r.top,
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 30,
                  background: BRAND.ember,
                }}
              />
              <div
                style={{
                  display: "flex",
                  marginLeft: 18,
                  fontSize: 20,
                  fontFamily: "monospace",
                  color: BRAND.soft,
                }}
              >
                {r.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
