import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "bb",
    short_name: "bb",
    description: "A tiny private world for two people who love each other from afar.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f1ea",
    theme_color: "#f7f1ea",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
