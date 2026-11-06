import { CATEGORIES, TELLS, type Category, type Tell } from "./tells";
import type { PageResult } from "./types";

export type TellScore = {
  tell: Tell;
  /** 0 to 1: how fully present the tell is across the site. */
  severity: number;
  instances: number;
  pages: string[];
  cost: number;
};

export type Score = {
  overall: number;
  categories: { id: Category; name: string; score: number; cost: number }[];
  tells: TellScore[];
  pageScores: { url: string; score: number }[];
};

// Larger means more forgiving. Chosen so one strong tell lands near 75 and a typical template near 30.
const SITE_TAU = 10;
const CATEGORY_TAU = 4;

function severityOf(tell: Tell, pages: PageResult[]) {
  const hit = pages.filter((p) => (p.counts[tell.id] || 0) > 0);
  const instances = pages.reduce((a, p) => a + (p.counts[tell.id] || 0), 0);
  if (!hit.length) return { severity: 0, instances, hit };
  const coverage = hit.length / pages.length;
  const intensity = Math.min(1, instances / (tell.saturation * pages.length));
  return { severity: 0.5 * coverage + 0.5 * intensity, instances, hit };
}

export function scoreSite(pages: PageResult[]): Score {
  const tells: TellScore[] = TELLS.map((tell) => {
    const { severity, instances, hit } = severityOf(tell, pages);
    return { tell, severity, instances, pages: hit.map((p) => p.url), cost: tell.weight * severity };
  })
    .filter((t) => t.instances > 0)
    .sort((a, b) => (a.tell.level === b.tell.level ? b.cost - a.cost : a.tell.level === "fix" ? -1 : 1));

  const total = tells.reduce((a, t) => a + t.cost, 0);
  const categories = CATEGORIES.map((c) => {
    const cost = tells.filter((t) => t.tell.category === c.id).reduce((a, t) => a + t.cost, 0);
    return { ...c, cost, score: Math.round(100 * Math.exp(-cost / CATEGORY_TAU)) };
  });
  const pageScores = pages.map((p) => {
    const cost = TELLS.reduce((a, tell) => a + tell.weight * severityOf(tell, [p]).severity, 0);
    return { url: p.url, score: Math.round(100 * Math.exp(-cost / SITE_TAU)) };
  });
  return { overall: Math.round(100 * Math.exp(-total / SITE_TAU)), categories, tells, pageScores };
}

export function band(score: number) {
  // the score measures how much of the generated look a site has, not who or what made it
  if (score >= 90) return { id: "good", label: "Few generated tells" } as const;
  if (score >= 50) return { id: "mid", label: "Some generated tells" } as const;
  return { id: "bad", label: "Many generated tells" } as const;
}
