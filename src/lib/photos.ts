// Curated photos for the landing page and demo covers. All are from Unsplash under the Unsplash
// License (free to use, no permission needed); they are generic stock photos, not real Amrita
// clubs or people. Credits are kept here and shown on the landing page.

export const UNSPLASH_HOST = "https://images.unsplash.com/photo-";

export function unsplash(id: string, w = 1600) {
  return `${UNSPLASH_HOST}${id}?auto=format&fit=crop&w=${w}&q=70`;
}

/** Resize a stored cover URL for its slot. Uploaded (bucket) images are returned unchanged. */
export function coverSrc(url: string, w: number) {
  if (!url.startsWith(UNSPLASH_HOST)) return url;
  const u = new URL(url);
  u.searchParams.set("w", String(w));
  return u.toString();
}

export const LANDING_PHOTOS = {
  hero: { id: "1522202176988-66273c2fd55f", alt: "Three students laughing together over a laptop", credit: "Brooke Cagle" },
  study: { id: "1758270705290-62b6294dd044", alt: "A group of students gathered around a laptop", credit: "Vitaly Gariev" },
  library: { id: "1553448539-f6063db586a4", alt: "Students studying in a library", credit: "Christian Wiediger" },
  robotics: { id: "1532186773960-85649e5cb70b", alt: "A robotic arm above a circuit board", credit: "Louis Reed" },
  dance: { id: "1463592177119-bab2a00f3ccb", alt: "Three dancers performing a traditional Indian dance", credit: "pavan gupta" },
  green: { id: "1551855350-c86caeaf8707", alt: "A student planting a sapling", credit: "Dmitry Dreyer" },
  hack: { id: "1631350397792-8e0c2de5b637", alt: "Students coding on laptops at a hackathon", credit: "algoleague" },
} as const;
