import type { InpageResult } from "./types";

/**
 * Runs inside the audited page through page.evaluate, so it must stay self-contained:
 * no imports, no closures over module scope. It reads computed styles and layout of
 * what is actually rendered, not the source.
 */
export function inpageAudit(): InpageResult {
  const MAX_EXAMPLES = 25;
  const findings: InpageResult["findings"] = [];
  const counts: Record<string, number> = {};
  const seenKeys: Record<string, boolean> = {};

  const AI_FONTS = /instrument[\s_-]*serif|instrument[\s_-]*sans|geist|space[\s_-]*grotesk|ibm[\s_-]*plex[\s_-]*mono|jetbrains[\s_-]*mono|space[\s_-]*mono/i;
  const MONO = /(^|[\s_-])mono($|[\s_-])|monospace|courier|consolas|menlo|monaco|source[\s_-]*code|fira[\s_-]*code/i;
  const SKIP = "script,style,noscript,template,svg,code,pre,kbd,samp,iframe,[aria-hidden='true']";
  const LOGO = "a[href='/'],a[href='./'],[class*='logo' i],[class*='wordmark' i],[class*='brand' i],[aria-label*='home' i]";
  const ABBR = /\b(?:Co|Inc|Ltd|LLC|St|Jr|Sr|Dr|Mr|Mrs|Ms|No|vs|etc|a\.m|p\.m)\.$/;

  const COPY: Record<string, RegExp> = {
    "stock-word": /\b(?:seamless(?:ly)?|elevat(?:e|es|ed|ing)|unlock(?:s|ed|ing)?|empower(?:s|ed|ing|ment)?|leverag(?:e|es|ed|ing)|cutting[- ]edge|game[- ]?chang(?:er|ers|ing)|revolutioni[sz](?:e|es|ed|ing)|next[- ]gen(?:eration)?|world[- ]class|best[- ]in[- ]class|state[- ]of[- ]the[- ]art|supercharg(?:e|es|ed|ing)|unleash(?:es|ed|ing)?|transformative|holistic|unparalleled|delv(?:e|es|ing)|tapestry|synerg(?:y|ies|istic)|ever[- ]evolving|fast[- ]paced|countless|a wide (?:range|variety|array) of|all (?:of )?your [\w ]{0,20}needs|one[- ]stop[- ]shop|peace of mind|hassle[- ]free|tailored to (?:your|fit your) (?:unique |specific )?needs|look no further|to the next level)\b/gi,
    hype: /\b(?:in today[’']s [\w -]{1,30}(?:world|landscape|age|era)|imagine a world|say goodbye to|let that sink in|read that again|here[’']s the (?:thing|kicker|catch|truth)|the best part\?|but wait|why wait\?|what if (?:you|we) could|ready to (?:take|get|transform|elevate|start|level|unlock|begin)\b[^?]{0,50}\?|don[’']t just take our word)/gi,
    "not-but": /\b(?:it[’']s|it is|this is|we[’']re|we are|isn[’']t|is) not just (?:a|an|about|another)\b|\bmore than just (?:a|an)\b/gi,
    emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{2604}\u{2607}-\u{26FF}\u{2700}-\u{2712}\u{2715}-\u{27BF}\u{2B50}]/gu,
    exclaim: /[A-Za-z0-9)]!(?=\s|$)/g,
    "em-dash": /—/g,
    stat: /\b\d[\d,.]*[kKM]?\+(?=\s+[A-Za-z]{2,}|\s*$)|\b(?:99(?:\.\d+)?|100)\s?%\s*(?:uptime|satisfaction|satisfied|guarantee|of (?:our )?(?:customers|clients))|#1\b|\b(?:5|five)[- ]stars?\b|\b[34]\.\d\s*(?:\/\s*5|stars?|rating|out of 5)|\brated\s+\d|\b\d{2,}\+?\s+years? (?:of )?(?:experience|in business)|\bsince (?:19|20)\d\d\b|\bfounded in (?:19|20)\d\d\b/gi,
    proof: /★{3,}|\btrusted by\b|\bas (?:seen|featured) (?:on|in)\b|\bfeatured in\b|\baward[- ]winning\b|\bSOC ?2\b|\bHIPAA\b|\bISO ?27001\b|\bPCI[- ]DSS\b|\bGDPR[- ]compliant\b|\blicensed (?:and|&) insured\b|\bbonded (?:and|&) insured\b|\bcertified (?:experts|professionals|technicians)\b|\bhappy (?:customers|clients)\b/gi,
    "fake-live": /\b\d+ (?:people|others|users|customers) (?:are )?(?:viewing|watching|looking|booked)\b|\bonly \d+ (?:spots?|seats?|slots?|left)\b|\b(?:spots?|seats?) left\b|\bselling fast\b|\blimited[- ]time offer\b|\boffer ends\b|\bact now\b/gi,
    placeholder: /\b[Ll]orem ipsum\b|\bdolor sit amet\b|\bYour Company(?: Name)?\b|\b[Cc]ompany Name\b|\bAcme (?:Inc|Corp)\b|\b(?:John|Jane) Doe\b|\bTODO\b|\b[Ii]nsert [\w ]{1,20} here\b/g,
  };
  const STACCATO = /^(?:[A-Za-z][\w'’-]*(?: [\w'’-]+){0,3}[.!] ){2,}[A-Za-z][\w'’-]*(?: [\w'’-]+){0,3}[.!]?$/;
  const COMMON = new Set(["To", "Your", "Our", "For", "With", "The", "And", "Of", "In", "On", "At", "By", "From", "Is", "Are", "We", "You", "Us", "It", "Get", "Started", "Now", "Today", "Here", "More", "Learn", "Free", "How", "What", "Why", "Who", "Can", "Will", "That", "This", "Into", "About", "Start", "Book", "Make", "Every", "All"]);
  const SMALL = new Set(["a", "an", "the", "and", "or", "but", "of", "in", "on", "to", "for", "at", "by", "with", "from", "as", "is", "vs", "per", "&", "your", "our", "my"]);

  const csCache = new Map<Element, CSSStyleDeclaration>();
  function cs(el: Element) {
    let s = csCache.get(el);
    if (!s) {
      s = getComputedStyle(el);
      csCache.set(el, s);
    }
    return s;
  }
  // data-deslop-keep marks examples a page shows on purpose, such as a specimen or a quoted stock phrase
  function isVisible(el: Element) {
    if (el.closest("[data-deslop-keep]")) return false;
    const s = cs(el);
    if (s.display === "none" || s.visibility === "hidden" || s.visibility === "collapse" || parseFloat(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }
  function rectOf(el: Element) {
    let r = el.getBoundingClientRect();
    // box the text itself when a wide block holds a short line, so the crop stays readable
    if (r.width > 200 && /[A-Za-z]/.test(el.textContent || "")) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const t = range.getBoundingClientRect();
      if (t.width > 4 && t.height > 4 && t.width < r.width * 0.9) r = t;
    }
    return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
  }
  function clean(t: string | null | undefined) {
    return (t || "").replace(/\s+/g, " ").trim();
  }
  function ownText(el: Element) {
    let t = "";
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) t += n.textContent;
    });
    return clean(t);
  }
  function textOf(el: Element) {
    return clean((el as HTMLElement).innerText || el.textContent);
  }
  function cssPath(el: Element) {
    const parts: string[] = [];
    let e: Element | null = el;
    for (let i = 0; e && e.nodeType === 1 && i < 4; i++) {
      let s = e.tagName.toLowerCase();
      if (e.id && !/^[:\d]|radix|headlessui/.test(e.id)) {
        parts.unshift(s + "#" + CSS.escape(e.id));
        break;
      }
      const cls = Array.from(e.classList).filter((c) => !/^(?:__|css-|sc-|jsx-|svelte-|astro-)|[[\]:]/.test(c)).slice(0, 2);
      if (cls.length) s += "." + cls.map((c) => CSS.escape(c)).join(".");
      parts.unshift(s);
      e = e.parentElement;
    }
    return parts.join(" > ");
  }
  /** Count every instance, but keep examples only for distinct styles so one rule is not listed 40 times. */
  function add(tell: string, el: Element | null, detail: string, text?: string, key?: string) {
    counts[tell] = (counts[tell] || 0) + 1;
    const k = tell + "|" + (key ?? (el ? cssPath(el) + "|" + (text ?? "") : detail));
    if (seenKeys[k]) return;
    seenKeys[k] = true;
    if (findings.filter((f) => f.tell === tell).length >= MAX_EXAMPLES) return;
    findings.push({
      tell,
      path: el ? cssPath(el) : "",
      rect: el ? rectOf(el) : null,
      text: (text ?? (el ? textOf(el) : "")).slice(0, 160),
      detail,
    });
  }
  function px(v: string, basis: number) {
    if (!v) return 0;
    if (v.endsWith("%")) return (parseFloat(v) / 100) * basis;
    return parseFloat(v) || 0;
  }
  function hasBox(s: CSSStyleDeclaration) {
    const bg = s.backgroundColor;
    const bgVisible = bg && bg !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(bg);
    const border = parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== "none";
    return Boolean(bgVisible || border || s.backgroundImage !== "none" || s.boxShadow !== "none");
  }
  function isTitleCase(t: string) {
    const words = t.match(/[A-Za-z][\w'’-]*/g) || [];
    if (words.length < 3 || words.length > 10) return false;
    const big = words.filter((w) => !SMALL.has(w.toLowerCase()));
    if (!(big.length >= 3 && big.every((w) => w[0] === w[0].toUpperCase()) && !big.every((w) => w === w.toUpperCase()))) return false;
    // names like "Atlas Peak Heating & Cooling" are title case by nature; ordinary words capitalized mid-phrase are not
    return words.slice(1).some((w) => COMMON.has(w));
  }

  const all = Array.from(document.body.querySelectorAll("*"));
  const fontChars: Record<string, { n: number; el: Element; size: number }> = {};
  let textElements = 0;
  let visibleElements = 0;
  const vw = innerWidth;

  for (const el of all) {
    if (el.closest(SKIP)) continue;
    if (!isVisible(el)) continue;
    visibleElements++;
    const s = cs(el);
    const r = el.getBoundingClientRect();
    const t = ownText(el);
    const fs = parseFloat(s.fontSize) || 16;
    const tag = el.tagName;

    if (t && /[A-Za-z]{2}/.test(t)) {
      textElements++;
      const fam = s.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      const famKey = fam.replace(/^__/, "").replace(/_[0-9a-f]{5,}$/i, "").replace(/_Fallback.*$/i, "").replace(/_/g, " ");
      if (!fontChars[famKey]) fontChars[famKey] = { n: 0, el, size: 0 };
      fontChars[famKey].n += t.length;
      // the largest text set in a face makes the clearest example of it
      if (fs > fontChars[famKey].size && r.top + scrollY < 4000) {
        fontChars[famKey].el = el;
        fontChars[famKey].size = fs;
      }

      const inLogo = Boolean(el.closest(LOGO));
      const letters = t.replace(/[^A-Za-z]/g, "");
      if (!inLogo && fs < 40) {
        if (s.textTransform === "uppercase" && letters.length >= 3) {
          add("caps", el, "text-transform: uppercase", t, s.fontSize + s.fontWeight + s.letterSpacing + s.color);
        } else if (letters.length >= 8 && letters === letters.toUpperCase() && (t.match(/\b[A-Z]{5,}\b/g) || []).length >= 2) {
          add("caps", el, "typed in capitals", t);
        }
      }

      const ls = s.letterSpacing === "normal" ? 0 : parseFloat(s.letterSpacing);
      const parentLs = el.parentElement ? cs(el.parentElement).letterSpacing : "";
      if (ls / fs < -0.005 && (parentLs !== s.letterSpacing || !ownText(el.parentElement as Element))) {
        add("tracking", el, `letter-spacing: ${s.letterSpacing} at ${s.fontSize}`, undefined, s.fontSize + s.letterSpacing);
      }

      if (s.fontStyle === "italic" && !el.closest("blockquote,cite,q,figcaption") && (fs >= 20 || !/^(EM|I|CITE|Q|VAR|DFN)$/.test(tag)) && letters.length > 1) {
        add("italic", el, `font-style: italic at ${s.fontSize}`, undefined, s.fontSize + tag);
      }

      if (MONO.test(fam) || s.fontFamily.trim().startsWith("monospace")) {
        add("mono", el, `font-family: ${fam}`, t, fam + s.fontSize);
      }

      if (parseFloat((s as unknown as { webkitTextStrokeWidth: string }).webkitTextStrokeWidth || "0") > 0) {
        add("outline-text", el, "text stroke", t);
      }

      const clip = s.backgroundClip || (s as unknown as { webkitBackgroundClip: string }).webkitBackgroundClip;
      if (clip === "text" && /gradient\(/.test(s.backgroundImage)) {
        add("gradient-text", el, "gradient clipped to text", t);
      }

      const shadowBlur = Math.max(0, ...Array.from(s.textShadow.matchAll(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/g)).map((m) => parseFloat(m[3])));
      if (shadowBlur >= 12) add("glow", el, `text-shadow blur ${shadowBlur}px`, t);

      // section numbers and code-style labels, on short text only
      if (t.split(" ").length <= 6) {
        if (/^(?:0[1-9])(?:\s*[/·.—–-]\s*\S.*)?$/.test(t) || /^§\s*\d/.test(t) || /^(?:Chapter|Fig\.|Plate|Part)\s+[IVX\d]+\b/i.test(t) || /^[IVX]{1,4}\s*[./·—–-]\s+\w/.test(t)) {
          add("section-no", el, "numbered label", t, t.slice(0, 2));
        } else if (/^\/\/\s*\S/.test(t) || /^\[\d{1,2}\]$/.test(t) || /^[A-Z]{1,3}-0\d$/.test(t) || /^(?:STATUS|TEL|MAIL|AREA|ADDR|LOC|EST)\s*[:.]/.test(t) || /^\/(?!mo\b|month\b|yr\b|year\b|hr\b|hour\b|day\b|week\b|visit\b|person\b|each\b|unit\b)[a-z][\w-]*$/.test(t)) {
          add("breadcrumb", el, "code-style label", t);
        }
      }
    }

    // shapes and surfaces apply to any element
    const radius = px(s.borderTopLeftRadius, Math.min(r.width, r.height));
    const isControl = /^(A|BUTTON|SPAN|LI|LABEL|SMALL|P|DIV)$/.test(tag);
    if (radius >= r.height / 2 - 1 && r.height <= 64 && r.width > r.height * 1.25 && isControl && hasBox(s) && textOf(el)) {
      add("pill", el, `border-radius ${s.borderTopLeftRadius} on a ${Math.round(r.height)}px tall element`, undefined, s.borderTopLeftRadius + Math.round(r.height) + s.backgroundColor);
    } else if (radius >= 12 && radius < r.height / 2 - 1 && r.width >= 120 && r.height >= 80 && (hasBox(s) || tag === "IMG" || tag === "VIDEO")) {
      add("squircle", el, `border-radius ${s.borderTopLeftRadius}`, textOf(el).slice(0, 80), s.borderTopLeftRadius + Math.round(r.width / 50));
    }

    const surface = r.width >= vw * 0.45 || (textOf(el).length > 0 && r.width * r.height > 6000);
    if (/gradient\(/.test(s.backgroundImage) && surface && !(s.backgroundClip === "text")) {
      const hairline = r.height <= 3 || r.width <= 3;
      if (!hairline) add("gradient", el, s.backgroundImage.slice(0, 90), textOf(el).slice(0, 80), s.backgroundImage.slice(0, 60));
    }

    const blurs = Array.from(s.boxShadow.matchAll(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/g)).map((m) => parseFloat(m[3]));
    if (blurs.some((b) => b >= 40)) add("glow", el, `box-shadow blur ${Math.max(...blurs)}px`, textOf(el).slice(0, 80), s.boxShadow.slice(0, 60));
    const backdrop = s.backdropFilter || (s as unknown as { webkitBackdropFilter: string }).webkitBackdropFilter;
    if (backdrop && backdrop !== "none") add("glow", el, `backdrop-filter: ${backdrop}`, textOf(el).slice(0, 80), "backdrop" + backdrop);
    if (/blur\(/.test(s.filter) && r.width * r.height > 60000) add("glow", el, `blurred shape, filter: ${s.filter}`, "", "filter" + s.filter);

    const blw = parseFloat(s.borderLeftWidth);
    if (blw >= 3 && s.borderLeftStyle !== "none" && blw >= 2 * parseFloat(s.borderTopWidth) && blw >= 2 * parseFloat(s.borderRightWidth) && r.height > 30 && tag !== "BLOCKQUOTE" && !el.closest("[role='alert'],[role='status']")) {
      add("stripe", el, `border-left ${s.borderLeftWidth} ${s.borderLeftColor}`, textOf(el).slice(0, 80), s.borderLeftColor + s.borderLeftWidth);
    }

    if (/^url\(.*(noise|grain|dither)/i.test(s.backgroundImage)) add("noise", el, "noise texture image", "", "noise-img");

    if (s.animationName !== "none" && /infinite/.test(s.animationIterationCount)) {
      if (r.width <= 16 && r.height <= 16) add("gadget", el, `pulsing dot (${s.animationName})`, textOf(el.parentElement || el).slice(0, 60), "dot");
      else if (r.width > vw * 1.2) add("gadget", el, `endless marquee (${s.animationName})`, textOf(el).slice(0, 60), "marquee");
    }
  }

  if (cs(document.body).cursor === "none" || cs(document.documentElement).cursor === "none") add("gadget", null, "custom cursor replaces the pointer", "", "cursor");
  if (document.querySelector("feTurbulence")) add("noise", document.querySelector("feTurbulence")?.closest("svg") || null, "SVG fractal noise filter", "", "feTurbulence");

  // fonts by share of visible text
  const totalChars = Object.values(fontChars).reduce((a, b) => a + b.n, 0) || 1;
  const fonts = Object.entries(fontChars)
    .map(([family, v]) => ({ family, share: v.n / totalChars, el: v.el }))
    .sort((a, b) => b.share - a.share);
  for (const f of fonts) {
    if (AI_FONTS.test(f.family) && f.share >= 0.03) {
      add("font", f.el, `${f.family} sets ${Math.round(f.share * 100)}% of the text`, f.family, f.family);
    }
  }

  // headings
  const headings = Array.from(document.querySelectorAll("h1,h2,h3")).filter((h) => isVisible(h) && !h.closest(SKIP));
  for (const h of headings) {
    const t = textOf(h);
    if (!t) continue;
    if (t.endsWith(".") && !t.endsWith("...") && !ABBR.test(t) && t.length < 160) add("period", h, "heading ends in a period", t);
    if (STACCATO.test(t)) add("staccato", h, "short sentences in a row", t);
    else if (isTitleCase(t)) add("title-case", h, "every word capitalized", t);

    const hs = cs(h);
    const accent = Array.from(h.querySelectorAll("em,i,span,strong,mark")).find((c) => {
      if (!isVisible(c) || !textOf(c)) return false;
      const ccs = cs(c);
      if (!ccs.display.startsWith("inline")) return false;
      return ccs.fontStyle === "italic" || ccs.color !== hs.color || ccs.fontFamily !== hs.fontFamily || /gradient\(/.test(ccs.backgroundImage);
    });
    if (accent) add("em-heading", h, `accent on “${textOf(accent).slice(0, 40)}”`, t);

    // eyebrow: a small, short label sitting right above the heading
    let prev: Element | null = h.previousElementSibling;
    if (!prev && h.parentElement && h.parentElement.firstElementChild === h) prev = h.parentElement.previousElementSibling;
    while (prev && (!isVisible(prev) || !textOf(prev)) && prev.previousElementSibling) prev = prev.previousElementSibling;
    if (prev && isVisible(prev) && !prev.closest(SKIP)) {
      const pt = textOf(prev);
      const pr = prev.getBoundingClientRect();
      const hr = h.getBoundingClientRect();
      const pfs = parseFloat(cs(prev).fontSize);
      const words = pt.split(" ").length;
      const gap = hr.top - pr.bottom;
      const isFunctional = /^(LABEL|LEGEND|DT|TH|NAV|BUTTON|TIME|IMG|FORM|INPUT|SELECT|UL|OL|TABLE)$/.test(prev.tagName) || prev.querySelector("time,img,svg,button,input,a[href]");
      const isDate = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/i.test(pt);
      const hfs = parseFloat(hs.fontSize);
      const ps = cs(prev);
      const styled = ps.textTransform === "uppercase" || parseFloat(ps.letterSpacing) / pfs > 0.05 || MONO.test(ps.fontFamily) || ps.color !== hs.color;
      const smaller = pfs <= 17 && (pfs <= hfs * 0.7 || (pfs < hfs && styled));
      if (pt && words <= 7 && smaller && gap > -4 && gap < Math.max(48, hfs * 0.9) && pr.left < hr.right && pr.right > hr.left && !isFunctional && !isDate) {
        add("eyebrow", prev, `label above “${t.slice(0, 50)}”`, pt);
      }
    }
  }

  // repeated card rows: a container whose 3+ children sit on one row at equal widths
  const rows: Element[] = [];
  for (const el of Array.from(document.querySelectorAll("main *, body > section, body > div *"))) {
    const s = cs(el);
    if (!(s.display.includes("grid") || s.display.includes("flex")) || el.closest(SKIP) || el.closest("nav,header,footer")) continue;
    const kids = Array.from(el.children).filter((k) => isVisible(k));
    if (kids.length < 3 || kids.length > 6) continue;
    const rs = kids.map((k) => k.getBoundingClientRect());
    const sameRow = rs.every((x) => Math.abs(x.top - rs[0].top) < 4);
    const sameWidth = rs.every((x) => Math.abs(x.width - rs[0].width) < rs[0].width * 0.06);
    const tall = rs.every((x) => x.height > 120 && x.width > 180);
    const withText = kids.every((k) => textOf(k).split(" ").length >= 4);
    if (sameRow && sameWidth && tall && withText && !rows.some((r) => r.contains(el) || el.contains(r))) rows.push(el);
  }
  if (rows.length >= 2) {
    rows.forEach((r, i) => add("template", r, `${rows.length} sections built from a row of ${r.children.length} equal cards`, textOf(r).slice(0, 80), "row" + i));
    counts.template = 1; // one finding per page, however many rows
  }

  // copy: group text nodes by their nearest block so phrases split by inline tags still match
  const blocks = new Map<Element, string>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let words = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    if (!parent || parent.closest(SKIP) || !n.textContent || !n.textContent.trim()) continue;
    if (!isVisible(parent)) continue;
    let block: Element = parent;
    while (block.parentElement && cs(block).display.startsWith("inline") && block !== document.body) block = block.parentElement;
    blocks.set(block, (blocks.get(block) || "") + n.textContent);
  }
  blocks.forEach((raw, block) => {
    const t = clean(raw);
    words += t.split(" ").length;
    for (const tell of Object.keys(COPY)) {
      const rx = COPY[tell];
      rx.lastIndex = 0;
      for (const m of Array.from(t.matchAll(rx))) {
        if (tell === "exclaim" && block.closest("[role='alert'],[role='status'],form")) continue;
        add(tell, block, `“${m[0].trim().slice(0, 50)}”`, t, m[0].toLowerCase() + cssPath(block));
      }
    }
    if (block.tagName === "P" && block.querySelectorAll("strong,b").length >= 2) add("bold", block, `${block.querySelectorAll("strong,b").length} bold phrases in one paragraph`, t);
  });

  for (const el of Array.from(document.querySelectorAll("a,button"))) {
    if (!isVisible(el) || el.closest(SKIP)) continue;
    const t = textOf(el);
    if (t && isTitleCase(t) && !el.closest(LOGO)) add("title-case", el, "every word capitalized", t);
  }

  // links that go nowhere
  for (const a of Array.from(document.querySelectorAll("a"))) {
    if (!isVisible(a) || a.closest(SKIP)) continue;
    const href = a.getAttribute("href");
    if (href === null) continue;
    const h = href.trim();
    if (h === "" || h === "#" || /^javascript:/i.test(h)) {
      add("dead-end", a, `href="${h}"`, textOf(a) || a.getAttribute("aria-label") || "");
    } else if (h.startsWith("#") && h.length > 1) {
      let id = h.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        /* keep raw */
      }
      if (!document.getElementById(id) && !document.getElementsByName(id).length) add("dead-end", a, `anchor to missing section ${h}`, textOf(a));
    }
  }

  return {
    title: document.title,
    findings,
    counts,
    fonts: fonts.slice(0, 5).map((f) => ({ family: f.family, share: Math.round(f.share * 1000) / 1000 })),
    stats: { textElements, visibleElements, headings: headings.length, words, kept: document.querySelectorAll("[data-deslop-keep]").length },
  };
}
