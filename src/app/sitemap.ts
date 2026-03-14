import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const politicians = await prisma.politician.findMany({
    select: { id: true, updatedAt: true },
  });

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: "https://nokool.vercel.app",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://nokool.vercel.app/about",
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: "https://nokool.vercel.app/politicians",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: "https://nokool.vercel.app/compare",
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: "https://nokool.vercel.app/search",
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const politicianPages: MetadataRoute.Sitemap = politicians.map((pol) => ({
    url: `https://nokool.vercel.app/politician/${pol.id}`,
    lastModified: pol.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  return [...staticPages, ...politicianPages];
}
