import type { MetadataRoute } from "next";

/** Web app manifest — makes the site installable to a phone home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gym Tracker",
    short_name: "Gym",
    description:
      "Regista treinos, pesos, repetições e medidas corporais ao longo do tempo.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
    ],
  };
}
