import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  checkEligibility, mapStediToEligibility, serviceTypeCodesFor,
  eligibilityHasBenefits, eligibilityErrors, stediTransactionsOf, STEDI_COST_PER_CHECK,
} from '@/lib/stedi'
import { planRoute, resolveChannel } from '@/lib/routing'
import {
  getPayerByKey, getPayerByStediId, getPayerByPhone, type PayerProfile,
} from '@/lib/payer-registry'
import type { VerificationType } from '@/lib/verification-templates'
import type { EligibilityOutput } from '@/types'

const ELECTRONIC_TYPES: VerificationType[] = ['diagnostic', 'hearing_aid', 'abr', 'apd', 'vestibular', 'bcbs_oos']

function splitName(full: string): { first: string; last: string } {
  const parts = (full || '').trim().split(/\s+/)
  if (parts.length <= 1) return { first: parts[0] ?? '', last: '' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

/** Build an ad-hoc profile for a directory-selected payer (electronic only, no call routing yet). */
function adHocProfile(stediId: string, name: string): PayerProfile {
  return {
    key: `stedi:${stediId}`, name: name || stediId, stediPayerId: stediId,
    providerPhone: null, acceptsBots: false, hearingAidVendor: null,
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      clinicId, patientName, dob, memberId, codesRequested,
      providerNPI, clinicTaxId, clinicName, clinicAddress,
      verificationType, dateOfService, planType, state, diagnosisCode,
      callbackNumber, subscriberName, subscriberDob,
      payerKey, payerStediId, payerName, insurancePhone: legacyPhone,
    } = body

    const vType = verificationType as VerificationType

    // ── 1. Resolve the payer profile ────────────────────────────────────
    let payer: PayerProfile | undefined
    if (payerKey && String(payerKey).startsWith('stedi:')) {
      payer = adHocProfile(String(payerKey).slice('stedi:'.length), payerName)
    } else if (payerKey) {
      payer = getPayerByKey(payerKey)
    } else if (payerStediId) {
      payer = getPayerByStediId(payerStediId) ?? adHocProfile(payerStediId, payerName)
    } else if (legacyPhone) {
      payer = getPayerByPhone(legacyPhone)
    }
    if (!payer && !legacyPhone) {
      return NextResponse.json({ error: 'Select a payer before submitting.' }, { status: 400 })
    }

    // Clinic config: which carve-out vendors this clinic is contracted with (drives routing).
    let contractedVendors: string[] = []
    if (clinicId) {
      const { data: clinicRow } = await supabase
        .from('clinics').select('vendor_contracts').eq('id', clinicId).single()
      const vc = (clinicRow as { vendor_contracts?: string[] } | null)?.vendor_contracts
      if (Array.isArray(vc)) contractedVendors = vc
    }

    const plan = payer ? planRoute(vType, payer, contractedVendors) : null

    // ── 2. Electronic check first (runs even in TRIAL_MODE — it's not a call) ──
    let eligibilityOutput: EligibilityOutput | null = null
    let electronicHadBenefits = false
    let electronicNote: string | null = null
    let electronicChecks = 0 // billable Stedi transactions for this verification
    if (plan?.runElectronic && payer?.stediPayerId && ELECTRONIC_TYPES.includes(vType)) {
      try {
        const subName = subscriberName || patientName
        const subDob = subscriberDob || dob
        const { first, last } = splitName(subName)
        const resp = await checkEligibility({
          tradingPartnerServiceId: payer.stediPayerId,
          providerNpi: providerNPI,
          providerOrganizationName: clinicName,
          subscriberFirstName: first,
          subscriberLastName: last,
          subscriberDateOfBirth: subDob,
          subscriberMemberId: memberId,
          serviceTypeCodes: serviceTypeCodesFor(vType),
          dateOfService: dateOfService || undefined,
        })
        electronicChecks = stediTransactionsOf(resp) // cost incurred whether or not benefits returned
        if (eligibilityHasBenefits(resp)) {
          electronicHadBenefits = true
          eligibilityOutput = mapStediToEligibility(resp)
        } else {
          electronicNote = eligibilityErrors(resp).join('; ') || 'No usable benefits returned electronically.'
        }
      } catch (e) {
        electronicNote = `Electronic check failed: ${e instanceof Error ? e.message : 'unknown error'}`
      }
    }

    // ── 3. Decide channel + the number we'd dial ────────────────────────
    const channel = plan ? resolveChannel(plan, electronicHadBenefits) : 'autonomous_call'
    const dialNumber: string | null = plan?.call?.number ?? payer?.providerPhone ?? legacyPhone ?? null
    const storedPhone = dialNumber ?? 'electronic'

    // Hearing-aid carved out to a vendor the clinic isn't in → refer / private-pay.
    // It's a COMPLETE, actionable answer — record the disposition on the eligibility output.
    const isCarveOutRefer = channel === 'carve_out_refer'
    if (isCarveOutRefer && plan?.disposition) {
      if (!eligibilityOutput) {
        eligibilityOutput = {
          member: { patientName, dob, memberId },
          confidence: 'high',
          notes: 'Hearing-aid benefit is carved out to a vendor this clinic is not contracted with.',
        } as EligibilityOutput
      }
      eligibilityOutput.outcome = {
        status: 'redirected',
        nextAction: plan.disposition.nextAction,
        redirectPhone: plan.disposition.vendorPhone,
        redirectReason: plan.disposition.reason,
      }
    }

    const electronicDone = channel === 'electronic'
    const terminalComplete = electronicDone || isCarveOutRefer // done, no call needed
    const needsCall = !terminalComplete && (channel === 'autonomous_call' || channel === 'hybrid_call') && !!dialNumber

    // ── 4. Insert the call record ───────────────────────────────────────
    // Electronic always runs + completes here. A call is NEVER auto-fired — it's
    // recommended and biller-initiated (it rings their phone, so they choose when).
    // A call-needed verification is still "completed" electronically; the call is a
    // separate optional escalation (channel + null vapi_call_id = "call recommended").
    const status = (terminalComplete || needsCall) ? 'completed' : 'queued'
    const { data: callRecord, error: dbError } = await supabase
      .from('calls')
      .insert({
        clinic_id: clinicId,
        patient_name: patientName,
        dob: dob || null, member_id: memberId,
        insurance_phone: storedPhone,
        codes_requested: codesRequested,
        provider_npi: providerNPI, clinic_tax_id: clinicTaxId,
        clinic_name: clinicName, clinic_address: clinicAddress,
        callback_number: callbackNumber || null,
        phone_number_id: process.env.VAPI_PHONE_NUMBER_ID,
        verification_type: verificationType || null,
        // Date columns reject "" — coerce empty strings to null (|| not ??).
        date_of_service: dateOfService || null,
        plan_type: planType || null,
        state: state || null,
        diagnosis_code: diagnosisCode || null,
        subscriber_name: subscriberName || null,
        subscriber_dob: subscriberDob || null,
        status,
        channel, // electronic | autonomous_call | hybrid_call | carve_out_refer | needs_setup
        electronic_checks: electronicChecks,
        electronic_cost: Number((electronicChecks * STEDI_COST_PER_CHECK).toFixed(4)),
        structured_output_eligibility: eligibilityOutput,
        started_at: (terminalComplete || needsCall) ? new Date().toISOString() : null,
        ended_at: terminalComplete ? new Date().toISOString() : null,
      })
      .select()
      .single()
    if (dbError) throw new Error(dbError.message)

    // ── 5. Terminal — electronic completed it, OR HA refer-out (no call) ──
    if (terminalComplete) {
      return NextResponse.json({
        callId: callRecord.id, status: 'completed', channel,
        electronic: electronicDone,
        ...(isCarveOutRefer && plan?.disposition
          ? { referOut: true, note: `${plan.disposition.reason} ${plan.disposition.nextAction}` }
          : {}),
      })
    }

    // ── 6. Needs-setup (no callable number) — stage for the biller ───────
    if (channel === 'needs_setup' || !dialNumber) {
      const followUpTarget = plan?.call?.vendorName ?? payer?.name ?? 'the payer'
      return NextResponse.json({
        callId: callRecord.id, status, channel,
        electronicCaptured: electronicHadBenefits,
        note: electronicHadBenefits
          ? `Medical eligibility captured electronically. To finish, call ${followUpTarget} for the hearing-aid allowance — no number on file yet.`
          : `No call channel configured for this payer/type.${electronicNote ? ' ' + electronicNote : ''}`,
      })
    }

    // ── 7. Electronic done; a call is RECOMMENDED but NOT auto-fired. ─────
    // The biller reviews the electronic result, then initiates the call themselves
    // from the verification page (the Call button) if they decide it's needed.
    const callTargetName = plan?.call?.target === 'vendor'
      ? (plan?.call?.vendorName ?? 'the vendor')
      : (payer?.name ?? 'the insurance company')
    return NextResponse.json({
      callId: callRecord.id, status: 'completed', channel,
      electronicCaptured: electronicHadBenefits,
      callRecommended: true,
      callTarget: plan?.call?.target === 'vendor' ? 'vendor' : 'payer',
      callTargetName,
      callMode: channel === 'hybrid_call' ? 'hybrid' : 'autonomous',
      note: `Electronic foundation captured. A call to ${callTargetName} is recommended — ${plan?.call?.reason ?? 'to complete the verification'}. Start it from the verification page when ready.`,
    })
  } catch (err: unknown) {
    console.error('Call creation error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to start call' }, { status: 500 })
  }
}
