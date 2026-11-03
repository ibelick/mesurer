/// <reference path="./build.ts" />
export type MesurerFeatures = {
  screenshot?: boolean
  rulers?: boolean
  settings?: boolean
  responsive?: boolean
  /**
   * Saving a review. Disabled by default while the platform beta focuses on authentication.
   */
  review?: boolean
}

export type ResolvedMesurerFeatures = Required<MesurerFeatures>

export const DEFAULT_MESURER_FEATURES: ResolvedMesurerFeatures = {
  screenshot: true,
  rulers: true,
  settings: true,
  responsive: true,
  review: false,
}

export const resolveMesurerFeatures = (
  features?: MesurerFeatures,
): ResolvedMesurerFeatures => ({
  ...DEFAULT_MESURER_FEATURES,
  ...features,
  // Not to be asked for in a build that leaves saving out: see core/build.ts.
  review: Boolean(features?.review) && !globalThis.__MESURER_NO_REVIEW__,
})
