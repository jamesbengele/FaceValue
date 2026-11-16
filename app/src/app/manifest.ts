import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "FaceValue", short_name: "FaceValue", start_url: "/", display: "standalone", background_color: "#0b0a12", theme_color: "#0b0a12" };
}
