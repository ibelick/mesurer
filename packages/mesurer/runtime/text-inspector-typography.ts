const FONT_WEIGHT_KEYWORD: Record<string, string> = {
  "100": "thin",
  "200": "extralight",
  "300": "light",
  "400": "normal",
  "500": "medium",
  "600": "semibold",
  "700": "bold",
  "800": "extrabold",
  "900": "black",
};

const TYPO_PROPS = [
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
] as const;

type TypoProp = (typeof TYPO_PROPS)[number];

const TYPO_LABELS: Record<string, TypoProp> = {
  Family: "font-family",
  Size: "font-size",
  Weight: "font-weight",
  Line: "line-height",
  Tracking: "letter-spacing",
};

export type TypographyRow = {
  label: string;
  value: string;
  varName: string | null;
};

export type TypographyInfo = {
  rows: TypographyRow[];
  tagName: string;
  textSnippet: string;
};

type FlatRule = { rule: CSSStyleRule; mediaOk: boolean; order: number };
type Candidate = {
  name: string;
  specificity: number;
  order: number;
  important: boolean;
};

const formatPx = (raw: string) => {
  if (!raw || raw === "normal") return raw || "normal";
  const match = /^(-?[\d.]+)px$/.exec(raw);
  if (!match) return raw;
  return `${Math.round(Number(match[1]) * 10) / 10}px`;
};

const firstFontFamily = (families: string) =>
  (families.split(",")[0] ?? "").trim().replace(/^['"]|['"]$/g, "");

const weightWithKeyword = (weight: string) => {
  const keyword = FONT_WEIGHT_KEYWORD[weight];
  return keyword ? `${weight} / ${keyword}` : weight;
};

const extractVarName = (value: string | null | undefined) => {
  if (!value) return null;
  return /var\(\s*(--[a-zA-Z0-9_-]+)/.exec(value)?.[1] ?? null;
};

const selectorSpecificity = (selector: string) => {
  const ids = (selector.match(/#[\w-]+/g) ?? []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) ?? [])
    .length;
  const elements = (selector.match(/(?:^|[ >+~])([a-zA-Z][\w-]*)/g) ?? [])
    .length;
  return ids * 10000 + classes * 100 + elements;
};

const wins = (next: Candidate, previous: Candidate | undefined) => {
  if (!previous) return true;
  if (next.important !== previous.important) return next.important;
  if (next.specificity !== previous.specificity) {
    return next.specificity > previous.specificity;
  }
  return next.order > previous.order;
};

export class TypographyInspector {
  constructor(
    private readonly document: Document,
    private readonly window: Window,
  ) {}

  private collectRules(
    rules: CSSRuleList,
    output: FlatRule[],
    mediaOk: boolean,
    order: { value: number },
  ) {
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const currentOrder = order.value++;
      if (rule.type === 4) {
        const mediaRule = rule as CSSMediaRule;
        let matches = mediaOk;
        try {
          matches = mediaOk && this.window.matchMedia(mediaRule.media.mediaText).matches;
        } catch {
          matches = false;
        }
        this.collectRules(mediaRule.cssRules, output, matches, order);
      } else if (rule.type === 12) {
        this.collectRules((rule as CSSSupportsRule).cssRules, output, mediaOk, order);
      } else if (rule.type === 1) {
        output.push({
          rule: rule as CSSStyleRule,
          mediaOk,
          order: currentOrder,
        });
      }
    }
  }

  private getRules() {
    const rules: FlatRule[] = [];
    const order = { value: 0 };
    for (const sheet of Array.from(this.document.styleSheets)) {
      try {
        this.collectRules(sheet.cssRules, rules, true, order);
      } catch {
        continue;
      }
    }
    return rules;
  }

  private findVarReferences(el: HTMLElement): Record<TypoProp, string | null> {
    const result = Object.fromEntries(
      TYPO_PROPS.map((prop) => [prop, null]),
    ) as Record<TypoProp, string | null>;
    const rules = this.getRules();

    for (const prop of TYPO_PROPS) {
      let node: HTMLElement | null = el;
      while (node && result[prop] === null) {
        let winner: Candidate | undefined;
        const inlineValue = node.style.getPropertyValue(prop);
        const inlineName = extractVarName(inlineValue);
        if (inlineName) {
          winner = {
            name: inlineName,
            specificity: Number.MAX_SAFE_INTEGER,
            order: Number.MAX_SAFE_INTEGER,
            important: node.style.getPropertyPriority(prop) === "important",
          };
        }

        for (const { rule, mediaOk, order } of rules) {
          if (!mediaOk) continue;
          let matches = false;
          try {
            matches = node.matches(rule.selectorText);
          } catch {
            continue;
          }
          if (!matches) continue;
          const name = extractVarName(rule.style.getPropertyValue(prop));
          if (!name) continue;
          const candidate = {
            name,
            specificity: selectorSpecificity(rule.selectorText),
            order,
            important: rule.style.getPropertyPriority(prop) === "important",
          };
          if (wins(candidate, winner)) winner = candidate;
        }

        if (winner) result[prop] = winner.name;
        node = node.parentElement;
      }
    }
    return result;
  }

  getFast(el: HTMLElement): TypographyInfo {
    const styles = this.window.getComputedStyle(el);
    const rows: TypographyRow[] = [
      { label: "Family", value: firstFontFamily(styles.fontFamily), varName: null },
      { label: "Size", value: formatPx(styles.fontSize), varName: null },
      {
        label: "Weight",
        value: weightWithKeyword(styles.fontWeight),
        varName: null,
      },
      {
        label: "Line",
        value: styles.lineHeight === "normal" ? "normal" : formatPx(styles.lineHeight),
        varName: null,
      },
      {
        label: "Tracking",
        value:
          styles.letterSpacing === "normal"
            ? "normal"
            : formatPx(styles.letterSpacing),
        varName: null,
      },
    ];
    const directText = Array.from(el.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.nodeValue?.trim() ?? "")
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ");

    return {
      rows,
      tagName: el.tagName.toLowerCase(),
      textSnippet:
        directText.length > 40 ? `${directText.slice(0, 40)}…` : directText,
    };
  }

  getFull(el: HTMLElement, base = this.getFast(el)): TypographyInfo {
    const vars = this.findVarReferences(el);
    return {
      ...base,
      rows: base.rows.map((row) => ({
        ...row,
        varName: vars[TYPO_LABELS[row.label]],
      })),
    };
  }

}
