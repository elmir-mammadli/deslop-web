export type Rect = { x: number; y: number; w: number; h: number };

export type Finding = {
  tell: string;
  /** Short CSS path to the element. */
  path: string;
  rect: Rect | null;
  text: string;
  detail: string;
};

export type Crop = {
  tell: string;
  /** JPEG data URL. */
  src: string;
  width: number;
  height: number;
  /** The element's box inside the crop, in crop pixels. */
  box: Rect;
  text: string;
  path: string;
};

export type InpageResult = {
  title: string;
  findings: Finding[];
  counts: Record<string, number>;
  fonts: { family: string; share: number }[];
  stats: { textElements: number; visibleElements: number; headings: number; words: number; kept?: number };
};

export type PageResult = {
  url: string;
  title: string;
  counts: Record<string, number>;
  findings: Finding[];
  fonts: { family: string; share: number }[];
  stats: InpageResult["stats"];
  auditedAt: string;
};

export type PagePayload = {
  result: PageResult;
  /** HMAC of the result, checked when a report is saved. */
  sig: string;
  crops: Crop[];
  thumb: string | null;
};

export type SavedReport = {
  id: string;
  site: string;
  createdAt: string;
  pages: PageResult[];
  crops: Crop[];
  thumbs: Record<string, string>;
};
