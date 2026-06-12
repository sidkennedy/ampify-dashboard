// The routing brain. Given a verification type + payer profile (+ which carve-out
// vendors THIS clinic is contracted with), decide:
//  1) whether to run an electronic (Stedi) check first,
//  2) whether electronic ALONE can complete the answer,
//  3) if a call is needed, which number to dial and in what mode,
//  4) OR — for hearing aids carved out to a vendor the clinic ISN'T in — skip the
//     call entirely and return a "refer / private-pay" disposition.
//
// Philosophy: electronic-first (cheapest, instant), escalate only when needed,
// and never call a vendor the clinic can't bill.

import type { VerificationType } from './verification-templates'
import type { PayerProfile } from './payer-registry'

export type CallMode = 'autonomous' | 'hybrid'
export type CallTarget = 'payer' | 'vendor'
export type Channel = 'electronic' | 'autonomous_call' | 'hybrid_call' | 'carve_out_refer' | 'needs_setup'

export interface CallPlan {
  number: string | null
  mode: CallMode
  target: CallTarget
  vendorName?: string | null
  reason: string
}

// Returned when a hearing-aid benefit is carved out to a vendor the clinic is NOT
// contracted with — the answer is "refer / private-pay", no call needed.
export interface CarveOutDisposition {
  vendorName: string
  vendorPhone: string | null
  reason: string
  nextAction: string
}

export interface RoutePlan {
  runElectronic: boolean
  electronicCanComplete: boolean
  call: CallPlan | null
  disposition: CarveOutDisposition | null
  summary: string
}

const ELECTRONIC_COMPLETE: VerificationType[] = ['diagnostic', 'bcbs_oos']
const ELECTRONIC_FOUNDATION: VerificationType[] = ['abr', 'apd', 'vestibular', 'hearing_aid']

function callMode(acceptsBots: boolean): CallMode {
  return acceptsBots ? 'autonomous' : 'hybrid'
}

function isContracted(vendorName: string, contractedVendors: string[]): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
  return contractedVendors.some(v => norm(v) === norm(vendorName))
}

/**
 * @param contractedVendors  Names of the carve-out vendors (TPAs) THIS clinic is
 *   credentialed with. Default [] → not in any vendor network (correct for a
 *   practice that avoids TPAs). Populated from clinic onboarding config.
 */
export function planRoute(
  verificationType: VerificationType,
  payer: PayerProfile,
  contractedVendors: string[] = [],
): RoutePlan {
  const runElectronic = !!payer.stediPayerId
  const electronicCanComplete = runElectronic && ELECTRONIC_COMPLETE.includes(verificationType)

  // Hearing aids: the allowance lives with the carve-out vendor (or payer HA dept).
  if (verificationType === 'hearing_aid') {
    const vendor = payer.hearingAidVendor
    if (vendor) {
      // Only call the vendor if this clinic is actually contracted with them.
      if (isContracted(vendor.name, contractedVendors)) {
        return {
          runElectronic, electronicCanComplete: false, disposition: null,
          call: {
            number: vendor.phone, mode: 'autonomous', target: 'vendor', vendorName: vendor.name,
            reason: `HA benefit runs through ${vendor.name}; clinic is contracted — call the vendor for the allowance.`,
          },
          summary: `Electronic foundation + autonomous call to ${vendor.name}.`,
        }
      }
      // Not contracted with the carve-out vendor → CONFIRM with the payer. Don't
      // assume it's carved out: a plan may cover hearing aids DIRECTLY (an allowance
      // PAC can bill), and assuming self-pay would forfeit that revenue. The call
      // determines: covered? carved out to a 3rd party (→ self-pay) or direct (→ bill)?
      return {
        runElectronic, electronicCanComplete: false, disposition: null,
        call: {
          number: payer.providerPhone,
          mode: callMode(payer.acceptsBots),
          target: 'payer',
          reason: `Confirm with ${payer.name}: is the hearing-aid benefit carved out to a third party such as ${vendor.name} (→ self-pay through the office), or covered directly (→ bill the payer; capture the allowance)?`,
        },
        summary: `Electronic foundation + ${callMode(payer.acceptsBots)} call to ${payer.name} to confirm HA carve-out vs. direct coverage.`,
      }
    }
    // No vendor on file → verify the HA benefit with the payer directly.
    return {
      runElectronic, electronicCanComplete: false, disposition: null,
      call: {
        number: payer.providerPhone, mode: callMode(payer.acceptsBots), target: 'payer',
        reason: 'No carve-out vendor on file; verify HA benefit with the payer.',
      },
      summary: `Electronic foundation + ${callMode(payer.acceptsBots)} call to ${payer.name}.`,
    }
  }

  // ABR / APD / Vestibular: electronic foundation, then payer call for procedure-specific coverage.
  if (ELECTRONIC_FOUNDATION.includes(verificationType)) {
    return {
      runElectronic, electronicCanComplete: false, disposition: null,
      call: {
        number: payer.providerPhone, mode: callMode(payer.acceptsBots), target: 'payer',
        reason: 'Procedure-specific coverage / prior-auth typically needs a payer call.',
      },
      summary: `Electronic foundation + ${callMode(payer.acceptsBots)} call to ${payer.name}.`,
    }
  }

  // Diagnostic / BCBS-OOS: electronic usually completes. Call is fallback only.
  return {
    runElectronic, electronicCanComplete, disposition: null,
    call: payer.providerPhone
      ? {
          number: payer.providerPhone, mode: callMode(payer.acceptsBots), target: 'payer',
          reason: 'Fallback only — used if the electronic check returns no usable benefits.',
        }
      : null,
    summary: electronicCanComplete
      ? `Electronic (instant). Call to ${payer.name} only as fallback.`
      : `Call ${payer.name} (no Stedi id configured).`,
  }
}

/** Resolve the final channel label after we know whether electronic produced benefits. */
export function resolveChannel(plan: RoutePlan, electronicHadBenefits: boolean): Channel {
  // Hearing aid carved out to a vendor the clinic isn't in → refer / private-pay (a complete answer).
  if (plan.disposition) return 'carve_out_refer'
  // Electronic fully answered it — done, no call.
  if (electronicHadBenefits && plan.electronicCanComplete) return 'electronic'
  // A call is needed and we have a number to dial.
  if (plan.call?.number) return plan.call.mode === 'autonomous' ? 'autonomous_call' : 'hybrid_call'
  // A call is needed but we have no number (e.g. vendor line not on file) → biller follow-up.
  return 'needs_setup'
}
