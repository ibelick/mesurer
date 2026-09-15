export type MesurerFeatures = {
  screenshot?: boolean
  rulers?: boolean
  settings?: boolean
}

export type ResolvedMesurerFeatures = Required<MesurerFeatures>

export const DEFAULT_MESURER_FEATURES: ResolvedMesurerFeatures = {
  screenshot: true,
  rulers: true,
  settings: true,
}

export const resolveMesurerFeatures = (
  features?: MesurerFeatures,
): ResolvedMesurerFeatures => ({
  ...DEFAULT_MESURER_FEATURES,
  ...features,
})
