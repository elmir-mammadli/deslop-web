import type { Score } from "./score";
import type { PageResult } from "./types";

const pathOf = (url: string) => {
  try {
    const u = new URL(url);
    return u.pathname || "/";
  } catch {
    return url;
  }
};

/** A prompt to paste into Claude Code in the site's repository. */
export function fixPrompt(site: string, pages: PageResult[], score: Score) {
  const lines: string[] = [];
  lines.push(`Use the ai-deslop skill on this repository. A rendered Deslop audit of ${site} scored ${score.overall}/100 across ${pages.length} page${pages.length === 1 ? "" : "s"}.`);
  lines.push("");
  lines.push("Work through these in order. Fix-level tells must go; review-level tells need a verdict, and the honesty items need a source from me or they come out.");
  lines.push("");
  for (const t of score.tells) {
    const examples = pages
      .flatMap((p) => p.findings.filter((f) => f.tell === t.tell.id).map((f) => ({ f, page: pathOf(p.url) })))
      .slice(0, 3)
      .map(({ f, page }) => `${page} ${f.path ? "`" + f.path + "`" : ""} ${f.text ? "“" + f.text.slice(0, 70) + "”" : f.detail}`.replace(/\s+/g, " ").trim());
    lines.push(`- [${t.tell.level}] ${t.tell.name} (tell ${t.tell.skill}): ${t.instances} on ${t.pages.length} page${t.pages.length === 1 ? "" : "s"}. ${t.tell.action}`);
    for (const e of examples) lines.push(`    e.g. ${e}`);
  }
  lines.push("");
  lines.push("When done, run the skill's audit script and verify steps, then summarize what changed, what you kept on purpose and why.");
  lines.push("");
  lines.push("If the skill is not installed: /plugin marketplace add elmir-mammadli/ai-deslop, then /plugin install ai-deslop@ai-deslop");
  return lines.join("\n");
}
