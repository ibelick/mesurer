import { OBSERVED_MOTION_PROPERTIES } from "./motion"

export const cssVariables = (value: string) => [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(([, name]) => name)

// Read only accessible author rules. No library names, globals, or patched APIs.
export function createMotionDependencies(document?: Document) {
  type Rule = { selector?: string; animation?: string; properties: Map<string, string[]> }
  let scopes = new WeakMap<Node, Rule[]>()
  let opaque = new WeakSet<Node>()
  let cache = new WeakMap<Element, { names: string; properties: Map<string, string[]> }>()
  const tracked = new Map<Document | ShadowRoot, { sheets: CSSStyleSheet[]; signature: string }>()
  let lastRefresh = -Infinity
  const matchesMedia = (media?: string) => !media || !document?.defaultView?.matchMedia || document.defaultView.matchMedia(media).matches
  const sheetsOf = (scope: Document | ShadowRoot) => [...(scope.styleSheets ?? []), ...(scope.adoptedStyleSheets ?? [])]
  const signatureOf = (sheets: CSSStyleSheet[]) => {
    const seen = new Set<CSSStyleSheet>()
    const visit = (sheet: CSSStyleSheet): string => {
      if (seen.has(sheet)) return ""
      seen.add(sheet)
      try {
        const rules = (items: CSSRuleList, includeText = true): string => [...items].map((rule) => {
          const candidate = rule as CSSGroupingRule & CSSImportRule & CSSMediaRule
          return `${includeText ? rule.cssText : ""}:${matchesMedia(candidate.media?.mediaText)}:${candidate.styleSheet ? visit(candidate.styleSheet) : candidate.cssRules ? rules(candidate.cssRules, false) : ""}`
        }).join("\n")
        return `${sheet.disabled}:${matchesMedia(sheet.media?.mediaText)}:${rules(sheet.cssRules)}`
      } catch { return `${sheet.disabled}:${matchesMedia(sheet.media?.mediaText)}:opaque` }
    }
    return sheets.map(visit).join("\n")
  }
  const invalidate = () => { scopes = new WeakMap(); opaque = new WeakSet(); cache = new WeakMap() }
  const collect = (items: CSSRuleList, result: Rule[], animation?: string) => {
    for (const rule of items) {
      const candidate = rule as CSSStyleRule & CSSGroupingRule & CSSKeyframesRule
      const media = (rule as CSSMediaRule).media?.mediaText
      if (!matchesMedia(media)) continue
      const imported = (rule as CSSImportRule).styleSheet
      if (imported && !imported.disabled && matchesMedia(imported.media?.mediaText)) collect(imported.cssRules, result)
      if (candidate.style) {
        const properties = new Map(OBSERVED_MOTION_PROPERTIES.map((property) => [property, cssVariables(candidate.style.getPropertyValue(property))]).filter(([, variables]) => variables.length) as [string, string[]][])
        if (properties.size) result.push({ selector: candidate.selectorText, animation, properties })
      }
      if (candidate.cssRules) collect(candidate.cssRules, result, candidate.name || animation)
    }
  }
  return {
    invalidate,
    // CSSOM edits and adoptedStyleSheets assignments have no mutation records.
    // Check only tracked source scopes, at most once per second.
    refresh(time: number) {
      if (time - lastRefresh < 1000) return false
      lastRefresh = time
      let changed = false
      for (const [scope, before] of tracked) {
        const sheets = sheetsOf(scope), signature = signatureOf(sheets)
        if (signature !== before.signature || sheets.length !== before.sheets.length || sheets.some((sheet, index) => sheet !== before.sheets[index])) {
          tracked.set(scope, { sheets, signature })
          changed = true
        }
      }
      if (changed) invalidate()
      return changed
    },
    hasOpaqueStyles(element: Element) { const scope = element.getRootNode?.() ?? document; return scope ? opaque.has(scope) : false },
    forElement(element: Element, names: string) {
      const scope = (element.getRootNode?.() ?? document) as Document | ShadowRoot | undefined
      let rules = scope ? scopes.get(scope) : []
      if (!rules) {
        rules = []
        const sheets = scope ? sheetsOf(scope) : []
        if (scope && !tracked.has(scope)) tracked.set(scope, { sheets, signature: signatureOf(sheets) })
        for (const sheet of sheets) {
          if (sheet.disabled || !matchesMedia(sheet.media?.mediaText)) continue
          try { collect(sheet.cssRules, rules) } catch { if (scope) opaque.add(scope) }
        }
        if (scope) scopes.set(scope, rules)
      }
      const cached = cache.get(element)
      if (cached?.names === names) return cached.properties
      const properties = new Map<string, string[]>()
      for (const rule of rules) {
        let matches = Boolean(rule.animation && names.split(",").some((name) => name.trim() === rule.animation))
        if (rule.selector) { try { matches = element.matches(rule.selector.replace(/::(?:before|after)\b/g, "")) } catch { continue } }
        if (!matches) continue
        for (const [property, variables] of rule.properties) properties.set(property, [...(properties.get(property) ?? []), ...variables])
      }
      cache.set(element, { names, properties })
      return properties
    },
  }
}
