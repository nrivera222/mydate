import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TWO LOVE",
    short_name: "TWO LOVE",
    description: "Verified high-profile dating · Dubai · Global",
    start_url: "/",
    display: "standalone",
    background_color: "#05040F",
    theme_color: "#05040F",
    icons: [
      { src: "/brand/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
