import type { MetadataRoute } from "next";

// PWA manifest (served at /manifest.webmanifest by Next's metadata route).
// Colors from the Atelier light palette in globals.css:
//   background_color = --paper (253 251 246) => #FDFBF6
//   theme_color      = --ink   (31 28 22)    => #1F1C16
export default function manifest(): MetadataRoute.Manifest {
  return {
    // "Language Studio", not "Vocabulary Studio": grammar is next, and iOS
    // never updates the name of an already-installed PWA. Widening it now,
    // while the install base is still small, is the cheap moment to do it.
    name: "Atelier — Studio học ngôn ngữ",
    short_name: "Atelier",
    description:
      "Studio luyện tiếng Anh theo lịch nhắc lại: hơn 8.000 từ A1–C1, bảy chế độ học và lịch ôn tính riêng cho bạn.",
    lang: "vi",
    start_url: "/",
    display: "standalone",
    background_color: "#FDFBF6",
    theme_color: "#1F1C16",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
