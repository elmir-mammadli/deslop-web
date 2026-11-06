import type { MetadataRoute } from "next";

// The samples are specimens for the home page, and reports belong to whoever ran them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: ["/sample/", "/r/", "/api/"] },
  };
}
