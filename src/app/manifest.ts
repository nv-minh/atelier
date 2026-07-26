import type { MetadataRoute } from "next";

// PWA manifest (served at /manifest.webmanifest by Next's metadata route).
// Colors from the Atelier light palette in globals.css:
//   background_color = --paper (253 251 246) => #FDFBF6
//   theme_color      = --ink   (31 28 22)    => #1F1C16
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atelier — Vocabulary Studio",
    short_name: "Atelier",
    description:
      "A refined spaced-repetition studio for mastering English vocabulary, A1 to C1.",
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
