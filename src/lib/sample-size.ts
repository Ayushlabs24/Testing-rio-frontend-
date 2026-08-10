// RIO-FR-024: Sample Size Calculator — mirrors the backend's
// `sample-size.ts` exactly (Cochran's formula + finite population
// correction + MDE), so the Study creation form can show the required
// sample size and MDE live, before the study is saved, instead of only
// after a round trip. The backend remains the source of truth for the
// value that's actually persisted — this is a client-side preview of the
// same fixed, signed-off formula, not an independent calculation.
//
// n0 = Z² · p(1−p) / e²        Cochran's uncorrected sample (worst-case p=0.5)
// n  = n0 / (1 + (n0−1)/N)     finite population correction for population N
// MDE = (1.4 / √n) × 100       minimum detectable effect, percentage points
//                              (95% confidence, 80% power, worst-case p=0.5)

const Z_95_PERCENT_CONFIDENCE = 1.96;
const WORST_CASE_PROPORTION = 0.5;
const MDE_NUMERATOR = 1.4;

export interface SampleSizeResult {
  requiredSampleSize: number;
  minimumDetectableEffect: number;
}

/** Returns null for inputs too incomplete/invalid to preview yet — the
 * caller should just not render a preview in that case, not show an error. */
export function previewSampleSize(
  population: number,
  marginOfError: number,
): SampleSizeResult | null {
  if (!Number.isInteger(population) || population <= 0) return null;
  if (!(marginOfError > 0) || !(marginOfError < 1)) return null;

  const n0 =
    (Z_95_PERCENT_CONFIDENCE ** 2 * WORST_CASE_PROPORTION * (1 - WORST_CASE_PROPORTION)) /
    marginOfError ** 2;
  const finitePopulationCorrected = n0 / (1 + (n0 - 1) / population);
  const requiredSampleSize = Math.max(1, Math.round(finitePopulationCorrected));
  const minimumDetectableEffect = (MDE_NUMERATOR / Math.sqrt(requiredSampleSize)) * 100;

  return { requiredSampleSize, minimumDetectableEffect };
}
