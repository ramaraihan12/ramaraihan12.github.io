import { site } from "@/content/site";

/** The link preview card. app/og.png/route.tsx renders it to a PNG at build time. */
export const ogImage = {
  url: "/og.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: `${site.name}, ${site.role.toLowerCase()} in ${site.location}`,
};
