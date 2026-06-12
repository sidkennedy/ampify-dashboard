// Feature flags / "expansion mode" — the product menu, toggle-able per clinic.
//
// BASE features ship to every clinic (always on in code). EXPANSION features are
// off by default and flipped on per clinic by a superadmin (stored in
// clinics.features jsonb, e.g. {"claim_status": true}). Some require a one-time
// Stedi enrollment of the clinic's NPI before they actually work.

export interface FeatureDef {
  key: string
  name: string
  description: string
  base: boolean // part of the standard product (always on)?
  needsEnrollment?: boolean // requires a one-time Stedi NPI enrollment to function
  stage: 'live' | 'beta' | 'planned' // build status (for the superadmin UI)
}

export const FEATURES: FeatureDef[] = [
  { key: 'eligibility', name: 'Eligibility & Benefits', description: 'Pre-visit insurance verification — coverage, deductible, OOP, cost-share.', base: true, stage: 'live' },
  { key: 'discovery', name: 'Insurance Discovery', description: 'Find a patient’s active coverage from just name + date of birth — even with no card or member ID.', base: true, needsEnrollment: true, stage: 'beta' },
  { key: 'claim_status', name: 'Claim Status Tracking', description: 'Automatically track the status of submitted claims (276/277) — stop chasing payers.', base: false, needsEnrollment: true, stage: 'planned' },
  { key: 'claims', name: 'Claims Submission', description: 'Submit professional claims electronically (837P).', base: false, needsEnrollment: true, stage: 'planned' },
  { key: 'era', name: 'Remittance / ERA', description: 'Electronic EOBs and automated payment posting (835).', base: false, needsEnrollment: true, stage: 'planned' },
  { key: 'cob', name: 'Coordination of Benefits', description: 'Identify primary vs. secondary payer for dual-coverage patients.', base: false, stage: 'planned' },
]

export const EXPANSION_FEATURES = FEATURES.filter(f => !f.base)
export const BASE_FEATURES = FEATURES.filter(f => f.base)

export type ClinicFeatures = Record<string, boolean>

/** Is a feature available for this clinic? Base features are always on; expansion features check the flag. */
export function clinicHasFeature(clinic: { features?: ClinicFeatures | null } | null | undefined, key: string): boolean {
  const def = FEATURES.find(f => f.key === key)
  if (!def) return false
  if (def.base) return true
  return !!clinic?.features?.[key]
}

export function featureDef(key: string): FeatureDef | undefined {
  return FEATURES.find(f => f.key === key)
}
